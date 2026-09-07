#!/usr/bin/env python3
"""Scoped m.nong.cloud frontend release; retain the existing backend proxy."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime

CONF = Path('/etc/nginx/conf.d/m.nong.cloud.conf')
ROUTES = 'login|members|tasks|plots|services|supply|config|settings|audit'
MARKER = '# FUAN FRONTEND MANAGED RELEASE'


def run(args):
    return subprocess.check_output(args, stderr=subprocess.STDOUT, timeout=45)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def candidate_config(original, release):
    release = release.as_posix()
    # Reject unexpected layouts instead of guessing which server to change.
    if MARKER in original:
        raise RuntimeError('A managed release already exists; stop to inspect it before updating.')
    names = re.findall(r'^\s*server_name\s+([^;]+);', original, re.M)
    if not names or any(n.strip() != 'm.nong.cloud' for n in names):
        raise RuntimeError('Unexpected server_name; no configuration changed.')
    if not re.search(r'listen\s+(?:\[::\]:)?443\s+ssl', original):
        raise RuntimeError('Expected HTTPS listener missing.')
    locations = list(re.finditer(r'\blocation\s+[^\{]+\{', original))
    roots = list(re.finditer(r'(?m)^[ \t]*location\s+/\s*\{([^{}]*)\}', original))
    if len(roots) != 1 or len(locations) != 1:
        raise RuntimeError('Additional or unexpected locations found; inspect before deployment.')
    match = roots[0]
    if not re.search(r'proxy_pass\s+http://127\.0\.0\.1:8080\s*;', match.group(1)):
        raise RuntimeError('Expected port 8080 proxy missing.')
    additions = '''
    %s
    # Only UI routes are intercepted. Original location / remains unchanged.
    location = / {
        root %s;
        try_files /index.html =404;
        add_header Cache-Control "no-store";
    }
    location ^~ /fuan-ui/assets/ {
        alias %s/assets/;
    }
    location ~ ^/(%s)(/|$) {
        root %s;
        try_files /index.html =404;
        add_header Cache-Control "no-store";
    }

''' % (MARKER, release, release, ROUTES, release)
    return original[:match.start()] + additions + original[match.start():]


def atomic_config(data, metadata):
    fd, filename = tempfile.mkstemp(prefix='.fuan-', dir=str(CONF.parent))
    try:
        with os.fdopen(fd, 'wb') as out:
            out.write(data)
            out.flush()
            os.fsync(out.fileno())
        os.chmod(filename, metadata.st_mode & 0o777)
        os.chown(filename, metadata.st_uid, metadata.st_gid)
        os.replace(filename, str(CONF))
        if shutil.which('restorecon'):
            run(['restorecon', str(CONF)])
    finally:
        if os.path.exists(filename):
            os.unlink(filename)


def fetch(path, byte_range=False):
    command = ['curl', '--fail', '--silent', '--show-error', '--noproxy', '*',
               '--connect-timeout', '5', '--max-time', '15',
               '--resolve', 'm.nong.cloud:443:127.0.0.1']
    if byte_range:
        command += ['--range', '0-1023']
    return run(command + ['https://m.nong.cloud' + path])


def verify(release):
    expected = (release / 'index.html').read_bytes()
    for route in ['/', '/login', '/members/MB20260829001', '/plots/PL20260829023', '/services']:
        if fetch(route) != expected:
            raise RuntimeError('Live HTML mismatch: ' + route)
    for asset in sorted((release / 'assets').iterdir()):
        video = asset.suffix == '.mp4'
        actual = fetch('/fuan-ui/assets/' + asset.name, video)
        content = asset.read_bytes()
        if actual != (content[:1024] if video else content):
            raise RuntimeError('Live asset mismatch: ' + asset.name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Back up, publish, and verify')
    args = parser.parse_args()
    if os.name != 'posix' or os.geteuid() != 0:
        raise RuntimeError('Run this on the Aliyun Linux server as root.')
    for command in ['nginx', 'curl']:
        if not shutil.which(command):
            raise RuntimeError('Required command missing: ' + command)
    if CONF.is_symlink() or not CONF.is_file():
        raise RuntimeError('Config must be a regular file: ' + str(CONF))
    source = Path(__file__).resolve().parent / 'site'
    manifest = json.loads((source.parent / 'manifest.json').read_text())
    files = {p.relative_to(source).as_posix() for p in source.rglob('*') if p.is_file()}
    if files != set(manifest):
        raise RuntimeError('Bundle file list mismatch.')
    for name, expected in manifest.items():
        file = source / name
        if file.is_symlink() or source not in file.resolve().parents or digest(file) != expected:
            raise RuntimeError('Bundle integrity check failed: ' + name)
    if '/fuan-ui/assets/' not in (source / 'index.html').read_text():
        raise RuntimeError('Incorrect frontend asset base.')
    original = CONF.read_bytes()
    metadata = CONF.stat()
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + str(os.getpid())
    release = Path('/var/www/fuan-releases') / stamp
    proposed = candidate_config(original.decode('utf-8'), release).encode('utf-8')
    run(['nginx', '-t'])
    effective = run(['nginx', '-T']).decode('utf-8', errors='replace')
    if '# configuration file ' + str(CONF) + ':' not in effective:
        raise RuntimeError('Target configuration is not loaded by nginx.')
    print('Preflight passed. Existing backend proxy, certificates and nong.cloud are retained.', flush=True)
    if not args.apply:
        print('Check only. Run again with --apply to deploy.')
        return
    backup = Path('/var/backups/fuan-deploy') / stamp
    backup.mkdir(parents=True, mode=0o700)
    shutil.copy2(str(CONF), str(backup / CONF.name))
    release.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(str(source), str(release))
    for path in [release] + list(release.rglob('*')):
        path.chmod(0o755 if path.is_dir() else 0o644)
    if shutil.which('restorecon'):
        run(['restorecon', '-R', str(release)])
    print('BACKUP: ' + str(backup / CONF.name), flush=True)
    print('RELEASE: ' + str(release), flush=True)
    if CONF.read_bytes() != original:
        raise RuntimeError('Configuration changed during preparation; stopped without replacing it.')
    try:
        atomic_config(proposed, metadata)
        run(['nginx', '-t'])
        run(['nginx', '-s', 'reload'])
        for attempt in range(5):
            try:
                verify(release)
                break
            except Exception:
                if attempt == 4:
                    raise
                time.sleep(1)
    except BaseException:
        print('Deployment failed. Restoring original configuration...', flush=True)
        atomic_config(original, metadata)
        run(['nginx', '-t'])
        run(['nginx', '-s', 'reload'])
        print('Original configuration restored. Backup and release files retained.', flush=True)
        raise
    print('SUCCESS: https://m.nong.cloud (frontend demo; mock data)')
    print('Verified HTML routes, image/JS/CSS assets, and video byte-range playback delivery.')
    print('Original port 8080 proxy is unchanged; application API behavior was not tested.')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('STOP: ' + str(exc), file=sys.stderr)
        if isinstance(exc, subprocess.CalledProcessError):
            print(exc.output.decode('utf-8', errors='replace'), file=sys.stderr)
        sys.exit(1)
