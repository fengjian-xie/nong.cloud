#!/usr/bin/env python3
"""Forced-command helper: inventory or export <JSON array of inventory roots>.

Standard-library only. No shell, remote writes, environment/cookie/key reads,
or arbitrary command execution. Every export is private pending local review.
"""
import datetime
import fnmatch
import hashlib
import io
import json
import math
import os
from pathlib import PurePosixPath
import re
import stat
import subprocess
import sys
import tarfile
import time

SCAN_ROOTS = ("/var/www", "/root", "/home", "/opt", "/srv", "/data", "/www")
KNOWN_ROOTS = ("/var/www/nong.cloud", "/var/www/xiangqiao-api",
               "/var/www/xiangqiao-home", "/var/www/fuan-releases",
               "/var/www/xiangqiao-cloud-farm", "/var/www/xiangqiao-api-portal",
               "/var/www/xiangqiao-work")
MARKERS = {".git", "package.json", "pom.xml", "build.gradle", "build.gradle.kts",
           "go.mod", "Cargo.toml", "pyproject.toml", "requirements.txt",
           "composer.json", "manage.py", "app.json", "Gemfile"}
SKIP_DIRS = {".git", ".hg", ".svn", ".ssh", ".aws", ".aliyun", ".alibabacloud",
             ".config", ".gnupg", ".docker", ".cache", ".npm", ".local",
             ".venv", "venv", "node_modules", "vendor", "__pycache__",
             "credentials", "secrets", "cookies", "sessions", "uploads", "upload",
             "attachments", "private-attachments", "logs", "log", "cache",
             "tmp", "temp", "pgdata", "pg_wal", "mysql", "redis", "dumps"}
SECRET_NAMES = {"authorized_keys", "known_hosts", ".netrc", ".pgpass", ".my.cnf",
                ".npmrc", ".pypirc", ".git-credentials", ".bash_history",
                ".zsh_history", "cookies", "credentials"}
SECRET_PATTERNS = (".env", ".env.*", "id_rsa*", "id_dsa*", "id_ecdsa*", "id_ed25519*",
                   "credentials.*", "cookies.*", "*.pem", "*.key", "*.p12", "*.pfx",
                   "*.jks", "*.keystore", "*.kdb", "*.log", "*.pid", "*.sock",
                   "*.sqlite", "*.sqlite3", "*.db", "*.mdb", "*.rdb", "*.aof",
                   "*.dump", "*.bak", "*.sql.gz", "*.sql.bz2", "*.sql.xz",
                   "*.zip", "*.tar", "*.tar.gz", "*.tgz", "*.7z")
PRIVATE_PATTERNS = ("application*.properties", "application*.yml", "application*.yaml",
                    "*-prod.*", "*-production.*", "config.*", "*.config.*",
                    "settings.py", "local_settings.py", "database.*", "db.php",
                    "wp-config.php", "configuration.php", "parameters.yml",
                    "compose*.yml", "compose*.yaml", "docker-compose*", "*.conf",
                    "*.service", "*.php")
DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
FILE_FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK


class Refused(Exception):
    pass


class AccessWindow:
    def __init__(self, value):
        try:
            self.deadline = float(value)
        except (TypeError, ValueError):
            raise Refused("fixed access deadline is missing or invalid")
        now = time.time()
        if not math.isfinite(self.deadline) or not now < self.deadline <= now + 7201:
            raise Refused("fixed access deadline is expired or exceeds two hours")
        self.runtime_limit = time.monotonic() + 600

    def check(self):
        if time.time() >= self.deadline or time.monotonic() >= self.runtime_limit:
            raise Refused("fixed access deadline or ten-minute command limit reached")


class Policy:
    def __init__(self, scan_roots=SCAN_ROOTS, known_roots=KNOWN_ROOTS,
                 max_depth=6, max_dirs=20000, max_files=100000, max_bytes=5 * 1024**3,
                 access_window=None):
        self.scan_roots = tuple(scan_roots)
        self.known_roots = tuple(known_roots)
        self.max_depth, self.max_dirs = max_depth, max_dirs
        self.max_files, self.max_bytes = max_files, max_bytes
        self.access_window = access_window

    def check(self):
        if self.access_window is None:
            raise Refused("fixed access deadline is required")
        self.access_window.check()


def canonical_path(value):
    if not isinstance(value, str) or not value or len(value) > 4096:
        raise Refused("invalid root path")
    path = PurePosixPath(value)
    if (not path.is_absolute() or value != path.as_posix() or value == "/"
            or "\\" in value or any(ord(c) < 32 for c in value)
            or any(part in (".", "..") for part in path.parts)):
        raise Refused("noncanonical root path")
    return value


def open_root(path):
    """Open every path component without following a symlink, including ancestors."""
    canonical_path(path)
    fd = os.open("/", DIR_FLAGS)
    try:
        for part in PurePosixPath(path).parts[1:]:
            child = os.open(part, DIR_FLAGS, dir_fd=fd)
            os.close(fd)
            fd = child
        return fd
    except BaseException:
        os.close(fd)
        raise


def excluded_name(name, is_directory=False):
    lower = name.lower()
    if (not name or name in (".", "..") or "/" in name or "\\" in name
            or any(ord(c) < 32 for c in name)):
        return "unsafe_name"
    if lower in SECRET_NAMES or any(fnmatch.fnmatchcase(lower, p) for p in SECRET_PATTERNS):
        return "credential_runtime_or_archive"
    if is_directory and lower in SKIP_DIRS:
        return "excluded_directory"
    return None


def broad_root(path, policy):
    return (path == "/" or path in policy.scan_roots
            or PurePosixPath(path).parent == PurePosixPath("/home"))


def allowed_process_cwd(path, policy):
    try:
        canonical_path(path)
    except Refused:
        return False
    if broad_root(path, policy) or not any(path.startswith(anchor + "/") for anchor in policy.scan_roots):
        return False
    if any(excluded_name(part, True) for part in PurePosixPath(path).parts[1:]):
        return False
    try:
        fd = open_root(path)
    except OSError:
        return False
    os.close(fd)
    return True


def candidates(policy):
    policy.check()
    found, errors, visited, truncated = {}, 0, 0, False

    def add(path, reason):
        # Never make an entire home/data/system search anchor exportable.
        if broad_root(path, policy):
            return
        found.setdefault(path, set()).add(reason)

    def scan(fd, path, depth):
        nonlocal visited, errors, truncated
        policy.check()
        visited += 1
        if visited > policy.max_dirs:
            truncated = True
            return
        try:
            names = sorted(os.listdir(fd))
        except OSError:
            errors += 1
            return
        for name in names:
            policy.check()
            try:
                mode = os.stat(name, dir_fd=fd, follow_symlinks=False).st_mode
            except OSError:
                errors += 1
                continue
            if name in MARKERS and (stat.S_ISREG(mode) or (name == ".git" and stat.S_ISDIR(mode))):
                add(path, "marker:" + name)
            if (depth >= policy.max_depth or not stat.S_ISDIR(mode)
                    or excluded_name(name, True) or truncated):
                continue
            try:
                child = os.open(name, DIR_FLAGS, dir_fd=fd)
            except OSError:
                errors += 1
                continue
            try:
                scan(child, path + "/" + name, depth + 1)
            finally:
                os.close(child)

    for path in policy.scan_roots:
        policy.check()
        try:
            fd = open_root(path)
        except OSError:
            continue
        try:
            scan(fd, path, 0)
        finally:
            os.close(fd)
        if truncated:
            break
    for path in policy.known_roots:
        policy.check()
        try:
            fd = open_root(path)
        except OSError:
            continue
        os.close(fd)
        add(path, "known_nong_site_tree")
    processes = port_8080()
    policy.check()
    for process in processes["processes"]:
        cwd = process.get("cwd")
        if cwd and allowed_process_cwd(cwd, policy):
            add(cwd, "port_8080_cwd")
    return ([{"path": path, "reasons": sorted(reasons)} for path, reasons in sorted(found.items())],
            {"visited_directories": visited, "scan_errors": errors, "truncated": truncated,
             "port_8080": processes})


def port_8080():
    executable = next((p for p in ("/usr/bin/ss", "/usr/sbin/ss", "/bin/ss", "/sbin/ss")
                       if os.path.isfile(p) and os.access(p, os.X_OK)), None)
    if executable is None:
        return {"status": "ss_unavailable", "processes": []}
    try:
        result = subprocess.run([executable, "-H", "-ltnp", "sport = :8080"],
                                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                timeout=5, check=False, env={"LC_ALL": "C", "PATH": "/usr/sbin:/usr/bin:/sbin:/bin"})
    except (OSError, subprocess.TimeoutExpired):
        return {"status": "ss_failed", "processes": []}
    processes = []
    for pid in sorted({int(p) for p in re.findall(rb"pid=(\d+)", result.stdout)}):
        try:
            cwd = os.readlink("/proc/%d/cwd" % pid)
        except OSError:
            cwd = None
        processes.append({"pid": pid, "cwd": cwd})
    return {"status": "ok" if result.returncode == 0 else "ss_failed", "processes": processes}


def inventory(policy):
    roots, stats = candidates(policy)
    policy.check()
    return {"protocol": "nong-readonly-backup-v1", "candidate_roots": roots,
            "scan": {key: value for key, value in stats.items() if key != "port_8080"},
            "port_8080": stats["port_8080"],
            "limits": {"scan_max_depth": policy.max_depth, "max_files": policy.max_files,
                       "max_uncompressed_bytes": policy.max_bytes},
            "scope": "Candidate metadata only. No argv, environment, cookies, credentials or file contents.",
            "publication_policy": "All future exports are private pending local review."}


def file_class(relative):
    path = PurePosixPath(relative)
    name = path.name.lower()
    if name.endswith(".sql") and not any(p.lower() in ("migration", "migrations") for p in path.parts[:-1]):
        return "exclude", "unreviewed_sql_or_database_dump"
    if any(fnmatch.fnmatchcase(name, pattern) for pattern in PRIVATE_PATTERNS):
        return "private-review", "configuration_or_php_requires_private_review"
    return "source", None


def file_inventory(root_fd, policy):
    files, excluded = [], []

    def walk(fd, parts):
        policy.check()
        for name in sorted(os.listdir(fd)):
            policy.check()
            relative = "/".join(parts + (name,))
            try:
                st = os.stat(name, dir_fd=fd, follow_symlinks=False)
            except OSError:
                excluded.append({"path": relative, "reason": "stat_failed"})
                continue
            reason = excluded_name(name, stat.S_ISDIR(st.st_mode))
            if reason:
                excluded.append({"path": relative, "reason": reason})
            elif stat.S_ISLNK(st.st_mode):
                excluded.append({"path": relative, "reason": "symlink_never_followed"})
            elif stat.S_ISDIR(st.st_mode):
                if len(parts) >= 64:
                    excluded.append({"path": relative, "reason": "export_depth_limit"})
                    continue
                child = os.open(name, DIR_FLAGS, dir_fd=fd)
                try:
                    walk(child, parts + (name,))
                finally:
                    os.close(child)
            elif not stat.S_ISREG(st.st_mode) or st.st_nlink != 1:
                excluded.append({"path": relative, "reason": "special_file_or_hardlink"})
            else:
                category, reason = file_class(relative)
                if category == "exclude":
                    excluded.append({"path": relative, "reason": reason})
                    continue
                files.append({"path": relative, "category": category, "bytes": st.st_size})
                if len(files) > policy.max_files:
                    raise Refused("file count limit exceeded")
    walk(root_fd, ())
    return files, excluded


def open_relative(root_fd, relative):
    path = PurePosixPath(relative)
    if (path.is_absolute() or relative != path.as_posix() or not path.parts
            or any(p in (".", "..") or excluded_name(p, True) for p in path.parts)):
        raise Refused("unsafe relative export path")
    fd = os.dup(root_fd)
    try:
        for part in path.parts[:-1]:
            child = os.open(part, DIR_FLAGS, dir_fd=fd)
            os.close(fd)
            fd = child
        return os.open(path.name, FILE_FLAGS, dir_fd=fd)
    finally:
        os.close(fd)


class DigestReader:
    def __init__(self, stream, policy, budget=None):
        self.stream, self.digest, self.policy = stream, hashlib.sha256(), policy
        self.budget = budget if budget is not None else {"bytes": 0}

    def read(self, size=-1):
        self.policy.check()
        remaining = self.policy.max_bytes - self.budget["bytes"]
        if size < 0:
            size = remaining
        if size > remaining:
            raise Refused("actual export read byte limit exceeded")
        data = self.stream.read(size)
        self.budget["bytes"] += len(data)
        if self.budget["bytes"] > self.policy.max_bytes:
            raise Refused("actual export read byte limit exceeded")
        self.digest.update(data)
        return data


def export_roots(selected, policy, output):
    policy.check()
    if (not isinstance(selected, list) or not selected or len(selected) > 32
            or any(not isinstance(p, str) for p in selected) or len(set(selected)) != len(selected)):
        raise Refused("export requires a unique JSON array of 1 to 32 inventory roots")
    available, stats = candidates(policy)
    allowed = {root["path"] for root in available}
    for root in selected:
        canonical_path(root)
        if root not in allowed:
            raise Refused("requested root is not an inventory candidate")
    opened, total = [], 0
    try:
        for root in selected:
            policy.check()
            fd = open_root(root)
            opened.append({"path": root, "fd": fd, "id": hashlib.sha256(root.encode()).hexdigest()[:16]})
            files, excluded = file_inventory(fd, policy)
            opened[-1].update(files=files, excluded=excluded)
            total += sum(f["bytes"] for f in files)
        if total > policy.max_bytes or sum(len(r["files"]) for r in opened) > policy.max_files:
            raise Refused("export byte or file count limit exceeded")
        manifest = {"protocol": "nong-readonly-backup-v1", "created_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "publication_policy": "PRIVATE: all server files require local review; raw private-review/ files must not be publicly uploaded. Independently reviewed and redacted copies may be published separately.",
                    "scope": "Selected inventory candidates only. Exclusions mean this is not a whole-server backup. No database, credentials, cookies, symlinks or runtime uploads are exported.",
                    "scan": stats, "roots": []}
        actual_bytes, read_budget = 0, {"bytes": 0}
        with tarfile.open(fileobj=output, mode="w|gz", format=tarfile.PAX_FORMAT) as archive:
            for root in opened:
                policy.check()
                record = {"path": root["path"], "archive_id": root["id"], "files": [], "excluded": root["excluded"]}
                manifest["roots"].append(record)
                for item in root["files"]:
                    policy.check()
                    fd = open_relative(root["fd"], item["path"])
                    with os.fdopen(fd, "rb") as stream:
                        st = os.fstat(stream.fileno())
                        if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1:
                            raise Refused("file changed to a disallowed type during export")
                        actual_bytes += st.st_size
                        if actual_bytes > policy.max_bytes:
                            raise Refused("actual fstat export byte limit exceeded")
                        info = tarfile.TarInfo(item["category"] + "/" + root["id"] + "/" + item["path"])
                        info.size, info.mode, info.mtime = st.st_size, stat.S_IMODE(st.st_mode) & 0o777, int(st.st_mtime)
                        if item["category"] == "private-review":
                            info.mode = 0o600
                        reader = DigestReader(stream, policy, read_budget)
                        archive.addfile(info, reader)
                        after = os.fstat(stream.fileno())
                        record["files"].append({"path": item["path"], "archive_path": info.name, "bytes": st.st_size,
                                                "sha256": reader.digest.hexdigest(), "category": item["category"],
                                                "changed_during_read": (st.st_size, st.st_mtime_ns) != (after.st_size, after.st_mtime_ns)})
            manifest["uncompressed_file_bytes"] = actual_bytes
            manifest["read_file_bytes"] = read_budget["bytes"]
            data = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
            policy.check()
            info = tarfile.TarInfo("SERVER-BACKUP-MANIFEST.json")
            info.size, info.mode = len(data), 0o600
            archive.addfile(info, io.BytesIO(data))
    finally:
        for root in opened:
            os.close(root["fd"])


def run_command(command, policy, output, errors):
    try:
        policy.check()
        if not isinstance(command, str) or len(command) > 16384:
            raise Refused("invalid command")
        if command == "inventory":
            output.write((json.dumps(inventory(policy), ensure_ascii=False) + "\n").encode())
        elif command.startswith("export "):
            try:
                selected = json.loads(command[len("export "):])
            except (ValueError, RecursionError):
                raise Refused("export requires a JSON array")
            export_roots(selected, policy, output)
        else:
            raise Refused("only inventory and export JSON-array are permitted")
        return 0
    except (Refused, OSError, ValueError, tarfile.TarError) as exc:
        # Do not echo user command strings or source/config contents.
        message = str(exc) if isinstance(exc, Refused) else "filesystem or archive operation failed"
        errors.write((json.dumps({"error": message, "type": type(exc).__name__}) + "\n").encode())
        return 2


def run_from_environment(environment, output, errors):
    try:
        window = AccessWindow(environment.get("NONG_BACKUP_DEADLINE"))
    except Refused as exc:
        errors.write((json.dumps({"error": str(exc), "type": "Refused"}) + "\n").encode())
        return 2
    return run_command(environment.get("SSH_ORIGINAL_COMMAND", ""),
                       Policy(access_window=window), output, errors)


if __name__ == "__main__":
    if len(sys.argv) != 1:
        sys.stderr.write('{"error":"no command-line arguments permitted"}\n')
        sys.exit(2)
    sys.exit(run_from_environment(os.environ, sys.stdout.buffer, sys.stderr.buffer))
