import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import time
import unittest
from unittest import mock

SPEC = importlib.util.spec_from_file_location("helper", Path(__file__).with_name("readonly_backup_helper.py"))
helper = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(helper)


class HelperTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name).resolve()
        self.scan = self.base / "scan"
        self.project = self.scan / "nong"
        self.project.mkdir(parents=True)
        (self.project / "package.json").write_text('{"name":"fixture"}')
        (self.project / "main.js").write_text('console.log("fixture")\n')
        self.outside = self.base / "outside"
        self.outside.mkdir()
        (self.outside / "package.json").write_text('{}')
        (self.outside / "secret.txt").write_text('outside sentinel')
        self.policy = helper.Policy(scan_roots=(str(self.scan),), known_roots=(),
                                    access_window=helper.AccessWindow(time.time() + 3600))
        self.port = {"status":"fixture", "processes":[]}

    def tearDown(self):
        self.temp.cleanup()

    def run_helper(self, command):
        out, err = io.BytesIO(), io.BytesIO()
        with mock.patch.object(helper, "port_8080", return_value=self.port):
            status = helper.run_command(command, self.policy, out, err)
        return status, out.getvalue(), err.getvalue()

    def archive(self):
        status, data, err = self.run_helper("export " + json.dumps([str(self.project)]))
        self.assertEqual(status, 0, err)
        return tarfile.open(fileobj=io.BytesIO(data), mode="r:gz")

    def test_inventory_and_normal_export_preserve_bytes_and_hashes(self):
        status, out, err = self.run_helper("inventory")
        self.assertEqual(status, 0, err)
        roots = json.loads(out)["candidate_roots"]
        self.assertEqual([x["path"] for x in roots], [str(self.project)])
        with self.archive() as archive:
            manifest = json.load(archive.extractfile("SERVER-BACKUP-MANIFEST.json"))
            self.assertIn("PRIVATE", manifest["publication_policy"])
            for item in manifest["roots"][0]["files"]:
                data = archive.extractfile(item["archive_path"]).read()
                self.assertEqual(data, (self.project / item["path"]).read_bytes())
                self.assertEqual(hashlib.sha256(data).hexdigest(), item["sha256"])
            self.assertTrue(all(not name.startswith("/") and ".." not in Path(name).parts for name in archive.getnames()))

    def test_sensitive_runtime_files_are_not_read_or_exported(self):
        for name in [".env", ".env.production", "id_ed25519", "credentials.json", "production.sqlite", "server.log", "dump.sql"]:
            (self.project / name).write_text('excluded sentinel')
        for directory in [".ssh", ".aws", ".aliyun", ".config", "uploads", "private-attachments", "cookies"]:
            (self.project / directory).mkdir()
            (self.project / directory / "sentinel.txt").write_text('excluded sentinel')
        original = helper.open_relative
        opened = []
        def audit(fd, relative):
            opened.append(relative)
            return original(fd, relative)
        with mock.patch.object(helper, "open_relative", side_effect=audit), self.archive() as archive:
            self.assertEqual(set(opened), {"package.json", "main.js"})
            contents = [archive.extractfile(m).read() for m in archive.getmembers() if m.isfile() and m.name != "SERVER-BACKUP-MANIFEST.json"]
            self.assertFalse(any(b'excluded sentinel' in data for data in contents))

    def test_configuration_and_php_go_to_private_review(self):
        (self.project / "application-prod.properties").write_text('fixture_setting=local')
        (self.project / "join.php").write_text('<?php echo "fixture";')
        with self.archive() as archive:
            manifest = json.load(archive.extractfile("SERVER-BACKUP-MANIFEST.json"))
            files = {x["path"]: x for x in manifest["roots"][0]["files"]}
            for name in ["application-prod.properties", "join.php"]:
                self.assertEqual(files[name]["category"], "private-review")
                self.assertTrue(files[name]["archive_path"].startswith("private-review/"))

    def test_outside_and_noncanonical_roots_are_rejected_before_output(self):
        for root in [str(self.outside), "/etc", str(self.project) + "/../outside", "main.js", str(self.scan)]:
            status, data, _ = self.run_helper("export " + json.dumps([root]))
            self.assertEqual(status, 2)
            self.assertEqual(data, b"")

    def test_symlinks_and_hardlinks_never_export_target_bytes(self):
        (self.project / "leak.txt").symlink_to(self.outside / "secret.txt")
        (self.project / "linked-directory").symlink_to(self.outside, target_is_directory=True)
        (self.project / "inside-link.js").symlink_to(self.project / "main.js")
        os.link(self.outside / "secret.txt", self.project / "hardlink.txt")
        with self.archive() as archive:
            manifest = json.load(archive.extractfile("SERVER-BACKUP-MANIFEST.json"))
            excluded = {x["path"]: x["reason"] for x in manifest["roots"][0]["excluded"]}
            self.assertEqual(excluded["leak.txt"], "symlink_never_followed")
            self.assertEqual(excluded["linked-directory"], "symlink_never_followed")
            self.assertEqual(excluded["inside-link.js"], "symlink_never_followed")
            self.assertEqual(excluded["hardlink.txt"], "special_file_or_hardlink")
            for item in manifest["roots"][0]["files"]:
                self.assertNotIn(b'outside sentinel', archive.extractfile(item["archive_path"]).read())

    def test_symlink_ancestor_and_relative_traversal_are_rejected(self):
        alias = self.scan / "alias"
        alias.symlink_to(self.project, target_is_directory=True)
        with self.assertRaises(OSError):
            helper.open_root(str(alias))
        root_fd = helper.open_root(str(self.project))
        try:
            for path in ["../outside/secret.txt", "/etc/passwd", "a/../../secret", "leak.txt/../main.js"]:
                with self.assertRaises(helper.Refused):
                    helper.open_relative(root_fd, path)
        finally:
            os.close(root_fd)

    def test_arbitrary_commands_and_malformed_protocol_are_rejected(self):
        for command in ["", "sh", "id", "inventory; cat /etc/shadow", "export [] ; id", "export {}", "export []", "export [1]", "export null", "export ["]:
            with mock.patch.object(helper.subprocess, "run", side_effect=AssertionError("must not execute commands")):
                status, data, _ = self.run_helper(command)
            self.assertEqual(status, 2, command)
            self.assertEqual(data, b"", command)

    def test_depth_and_candidate_anchor_limits(self):
        (self.scan / "package.json").write_text('{}')
        deep = self.scan.joinpath(*["nested" + str(i) for i in range(7)])
        deep.mkdir(parents=True)
        (deep / "pom.xml").write_text('<project/>')
        roots, _ = helper.candidates(self.policy)
        paths = [x["path"] for x in roots]
        self.assertNotIn(str(self.scan), paths)
        self.assertNotIn(str(deep), paths)

    def test_missing_invalid_and_expired_fixed_deadlines_refuse_before_scan(self):
        for deadline in [None, "", "invalid", "nan", "inf", str(time.time() - 1), str(time.time() + 10000)]:
            environment = {"SSH_ORIGINAL_COMMAND": "inventory"}
            if deadline is not None:
                environment["NONG_BACKUP_DEADLINE"] = deadline
            out, err = io.BytesIO(), io.BytesIO()
            with mock.patch.object(helper, "candidates", side_effect=AssertionError("must not scan")):
                status = helper.run_from_environment(environment, out, err)
            self.assertEqual(status, 2)
            self.assertEqual(out.getvalue(), b"")

    def test_deadline_and_runtime_rechecked_during_stream_reads(self):
        reader = helper.DigestReader(io.BytesIO(b"fixture"), self.policy)
        self.policy.access_window.deadline = time.time() - 1
        with self.assertRaises(helper.Refused):
            reader.read(2)
        self.policy.access_window.deadline = time.time() + 100
        self.policy.access_window.runtime_limit = time.monotonic() - 1
        with self.assertRaises(helper.Refused):
            helper.candidates(self.policy)

    def test_markerless_8080_runtime_cwd_is_explicit_export_candidate(self):
        runtime = self.scan / "runtime"
        runtime.mkdir()
        (runtime / "platform.jar").write_bytes(b"fixture jar bytes")
        self.port = {"status":"ok", "processes":[{"pid":123,"cwd":str(runtime)}]}
        status, data, err = self.run_helper("inventory")
        self.assertEqual(status, 0, err)
        roots = {x["path"]: x for x in json.loads(data)["candidate_roots"]}
        self.assertIn("port_8080_cwd", roots[str(runtime)]["reasons"])
        status, data, err = self.run_helper("export " + json.dumps([str(runtime)]))
        self.assertEqual(status, 0, err)
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            manifest = json.load(archive.extractfile("SERVER-BACKUP-MANIFEST.json"))
            exported = manifest["roots"][0]["files"][0]
            self.assertEqual(archive.extractfile(exported["archive_path"]).read(), b"fixture jar bytes")

    def test_8080_cwd_cannot_authorize_broad_sensitive_or_symlink_paths(self):
        sensitive = self.scan / ".ssh"
        sensitive.mkdir()
        alias = self.scan / "alias-runtime"
        alias.symlink_to(self.project, target_is_directory=True)
        for cwd in [str(self.scan), "/root", str(sensitive), str(self.outside), str(alias)]:
            self.port = {"status":"ok", "processes":[{"pid":123,"cwd":cwd}]}
            status, data, err = self.run_helper("inventory")
            self.assertEqual(status, 0, err)
            roots = [x["path"] for x in json.loads(data)["candidate_roots"]]
            self.assertNotIn(cwd, roots)

    def test_direct_user_home_is_never_a_candidate_even_with_marker_or_cwd(self):
        fake_home = self.base / "fake-home"
        user = fake_home / "alice"
        project = user / "nong"
        project.mkdir(parents=True)
        (user / "package.json").write_text('{}')
        (project / "pom.xml").write_text('<project/>')
        self.policy = helper.Policy(scan_roots=("/home",), known_roots=(),
                                    access_window=helper.AccessWindow(time.time() + 3600))
        self.port = {"status":"ok", "processes":[{"pid":123,"cwd":"/home/alice"}]}
        original = helper.open_root
        with mock.patch.object(helper, "open_root", side_effect=lambda path: original(str(fake_home)) if path == "/home" else original(path)):
            status, data, err = self.run_helper("inventory")
            self.assertEqual(status, 0, err)
            roots = [x["path"] for x in json.loads(data)["candidate_roots"]]
            self.assertNotIn("/home/alice", roots)
            self.assertIn("/home/alice/nong", roots)
            status, data, _ = self.run_helper('export ["/home/alice"]')
            self.assertEqual(status, 2)
            self.assertEqual(data, b"")

    def test_file_growth_after_inventory_cannot_bypass_actual_byte_limit(self):
        self.policy.max_bytes = 64
        original = helper.file_inventory
        def grow_after_listing(fd, policy):
            result = original(fd, policy)
            (self.project / "main.js").write_bytes(b"x" * 256)
            return result
        with mock.patch.object(helper, "file_inventory", side_effect=grow_after_listing):
            status, _, err = self.run_helper("export " + json.dumps([str(self.project)]))
        self.assertEqual(status, 2)
        self.assertIn("actual fstat export byte limit", json.loads(err)["error"])

    def test_actual_stream_read_budget_is_enforced(self):
        self.policy.max_bytes = 4
        budget = {"bytes":0}
        reader = helper.DigestReader(io.BytesIO(b"abcdef"), self.policy, budget)
        self.assertEqual(reader.read(3), b"abc")
        with self.assertRaises(helper.Refused):
            reader.read(2)
        self.assertEqual(budget["bytes"], 3)


if __name__ == "__main__":
    unittest.main()
