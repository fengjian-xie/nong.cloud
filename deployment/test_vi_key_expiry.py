import importlib.util
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

spec = importlib.util.spec_from_file_location("vi_key_expiry", Path(__file__).with_name("repair_vi_key_expiry.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class KeyExpiryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.directory.chmod(0o700)
        self.path = self.directory / "authorized_keys"
        self.backup = self.directory / "backup"
        self.original = b"# existing\r\nssh-ed25519 EXISTING existing\r\n" + module.OLD_LINE + b"\n# untouched\n"
        self.path.write_bytes(self.original)
        self.path.chmod(0o600)
        self.clock = mock.patch.object(module.time, "time", return_value=module.DEADLINE - 600)
        self.clock.start()
        self.zone = mock.patch.dict(os.environ, {"TZ": "UTC"})
        self.zone.start()
        time.tzset()

    def tearDown(self):
        self.clock.stop()
        self.zone.stop()
        time.tzset()
        self.temp.cleanup()

    def repair(self):
        return module.repair(self.path, self.backup, os.getuid())

    def test_only_exact_release_line_changes(self):
        result = self.repair()
        expected = self.original.replace(b'expiry-time="20261005130000Z"', b'expiry-time="20261005130000"')
        self.assertEqual(self.path.read_bytes(), expected)
        self.assertEqual(self.backup.read_bytes(), self.original)
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.backup.stat().st_mode & 0o777, 0o600)
        self.assertEqual(result["expiry_beijing"], "2026-10-05 21:00")

    def test_beijing_zone_keeps_same_deadline(self):
        with mock.patch.dict(os.environ, {"TZ": "Asia/Shanghai"}):
            time.tzset()
            self.assertEqual(module.compatible_expiry(), "20261005210000")
            self.repair()
            self.assertIn(b'expiry-time="20261005210000"', self.path.read_bytes())

    def test_repeat_is_noop(self):
        self.repair()
        before = self.path.read_bytes()
        self.assertEqual(self.repair()["status"], "XIANGQIAO_VI_TIME_FIXED_ALREADY")
        self.assertEqual(self.path.read_bytes(), before)

    def test_expired_refused(self):
        with mock.patch.object(module.time, "time", return_value=module.DEADLINE):
            with self.assertRaisesRegex(RuntimeError, "过期"):
                self.repair()
        self.assertEqual(self.path.read_bytes(), self.original)
        self.assertFalse(self.backup.exists())

    def test_duplicate_line_refused(self):
        duplicate = self.original + module.OLD_LINE + b"\n"
        self.path.write_bytes(duplicate)
        with self.assertRaisesRegex(RuntimeError, "唯一"):
            self.repair()
        self.assertEqual(self.path.read_bytes(), duplicate)

    def test_other_options_refused(self):
        changed = self.original.replace(b'restrict,expiry-time=', b'no-pty,expiry-time=')
        self.path.write_bytes(changed)
        with self.assertRaisesRegex(RuntimeError, "唯一"):
            self.repair()
        self.assertEqual(self.path.read_bytes(), changed)

    def test_symlink_refused(self):
        link = self.directory / "link"
        link.symlink_to(self.path)
        with self.assertRaisesRegex(RuntimeError, "类型"):
            module.repair(link, self.backup, os.getuid())
        self.assertEqual(self.path.read_bytes(), self.original)

    def test_insecure_mode_refused(self):
        self.path.chmod(0o666)
        with self.assertRaisesRegex(RuntimeError, "权限"):
            self.repair()
        self.assertEqual(self.path.read_bytes(), self.original)

    def test_backup_never_overwritten(self):
        self.backup.write_bytes(b"previous backup")
        with self.assertRaises(FileExistsError):
            self.repair()
        self.assertEqual(self.backup.read_bytes(), b"previous backup")
        self.assertEqual(self.path.read_bytes(), self.original)


if __name__ == "__main__":
    unittest.main()
