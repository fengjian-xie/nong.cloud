import importlib.util
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

spec = importlib.util.spec_from_file_location("vi_auth", Path(__file__).with_name("authorize_vi_release_2230.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.directory.chmod(0o700)
        self.path, self.backup = self.directory / "authorized_keys", self.directory / "backup"
        self.before = b"# original\r\nssh-ed25519 ORIGINAL user"
        self.path.write_bytes(self.before)
        self.path.chmod(0o600)
        self.clock = mock.patch.object(module.time, "time", return_value=module.DEADLINE - 1800)
        self.clock.start()
        self.zone = mock.patch.dict(os.environ, {"TZ": "UTC"})
        self.zone.start()
        time.tzset()

    def tearDown(self):
        self.clock.stop()
        self.zone.stop()
        time.tzset()
        self.temp.cleanup()

    def authorize(self):
        return module.authorize(self.path, self.backup, os.getuid())

    def test_append_preserves_existing_bytes_permissions_and_deadline(self):
        result = self.authorize()
        expected = self.before + b'\nrestrict,expiry-time="20261005143000" ' + module.KEY + b"\n"
        self.assertEqual(self.path.read_bytes(), expected)
        self.assertEqual(self.backup.read_bytes(), self.before)
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.backup.stat().st_mode & 0o777, 0o600)
        self.assertEqual(result["expiry_beijing"], "2026-10-05 22:30")

    def test_beijing_timezone(self):
        with mock.patch.dict(os.environ, {"TZ": "Asia/Shanghai"}):
            time.tzset()
            self.authorize()
            self.assertIn(b'expiry-time="20261005223000"', self.path.read_bytes())

    def test_duplicate_is_noop(self):
        self.authorize()
        before = self.path.read_bytes()
        self.assertTrue(self.authorize()["already_authorized"])
        self.assertEqual(self.path.read_bytes(), before)

    def test_expired_refused_without_writes(self):
        with mock.patch.object(module.time, "time", return_value=module.DEADLINE):
            with self.assertRaisesRegex(RuntimeError, "过期"):
                self.authorize()
        self.assertEqual(self.path.read_bytes(), self.before)
        self.assertFalse(self.backup.exists())

    def test_existing_backup_never_overwritten(self):
        self.backup.write_bytes(b"existing backup")
        with self.assertRaises(FileExistsError):
            self.authorize()
        self.assertEqual(self.path.read_bytes(), self.before)
        self.assertEqual(self.backup.read_bytes(), b"existing backup")

    def test_symlink_refused(self):
        link = self.directory / "link"
        link.symlink_to(self.path)
        with self.assertRaisesRegex(RuntimeError, "类型"):
            module.authorize(link, self.backup, os.getuid())
        self.assertEqual(self.path.read_bytes(), self.before)


if __name__ == "__main__":
    unittest.main()
