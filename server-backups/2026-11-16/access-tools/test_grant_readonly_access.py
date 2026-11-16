import base64
import hashlib
import importlib.util
import os
from pathlib import Path
import stat
import struct
import tempfile
import time
import unittest

HERE = Path(__file__).resolve().parent
TARGET = HERE / "grant_readonly_access.py"
if not TARGET.exists():
    TARGET = HERE / "grant_readonly_access.template.py"
SPEC = importlib.util.spec_from_file_location("grant", TARGET)
grant = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(grant)
BLOB = struct.pack(">I", 11) + b"ssh-ed25519" + struct.pack(">I", 32) + bytes(range(32))
PUBLIC_KEY = "ssh-ed25519 " + base64.b64encode(BLOB).decode() + " nong-code-readonly-fixture"
HELPER = b"# fixture: no remote access\n"


class GrantTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name) / "account"
        self.root.mkdir(mode=0o700)
        self.ssh = self.root / ".ssh"
        self.ssh.mkdir(mode=0o700)
        self.auth = self.ssh / "authorized_keys"
        self.original = b"# existing authorization\nssh-ed25519 existing-key existing-comment"
        self.auth.write_bytes(self.original)
        self.auth.chmod(0o640)
        self.uid = os.geteuid()

    def tearDown(self):
        self.temporary.cleanup()

    def authorize(self, key=PUBLIC_KEY):
        return grant.authorize(key, HELPER, self.root, self.uid, 1794801000)

    def test_appends_only_scoped_expiring_authorization_and_preserves_inode(self):
        before = self.auth.stat()
        record = self.authorize()
        after = self.auth.stat()
        self.assertEqual((before.st_ino, before.st_uid, stat.S_IMODE(before.st_mode)),
                         (after.st_ino, after.st_uid, stat.S_IMODE(after.st_mode)))
        data = self.auth.read_bytes()
        self.assertTrue(data.startswith(self.original + b"\nrestrict,"))
        self.assertEqual(data.count(b"nong-code-readonly-fixture"), 1)
        self.assertIn(b"/usr/bin/python3 -I -B -S ", data)
        self.assertIn(b"NONG_BACKUP_DEADLINE=", data)
        expiry = time.strftime("%Y%m%d%H%M%S", time.localtime(1794801000 + 7200))
        self.assertIn(('expiry-time="' + expiry + '"').encode(), data)
        self.assertNotIn(('expiry-time="' + expiry + 'Z"').encode(), data)
        self.assertEqual(record["authorized_keys_sha256_after"], hashlib.sha256(data).hexdigest())
        self.assertEqual(record["authorized_keys_original_size"], len(self.original))
        self.assertTrue(record["inserted_separator_newline"])
        helper = Path(record["helper_path"])
        self.assertEqual(helper.read_bytes(), HELPER)
        self.assertEqual(stat.S_IMODE(helper.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(helper.parent.stat().st_mode), 0o700)

    def test_duplicate_key_refused_without_new_files_or_changes(self):
        self.authorize()
        before = self.auth.read_bytes()
        names = set(self.root.iterdir())
        with self.assertRaises(ValueError):
            self.authorize()
        self.assertEqual(self.auth.read_bytes(), before)
        self.assertEqual(set(self.root.iterdir()), names)

    def test_symlink_authorized_keys_refused(self):
        outside = self.root / "unrelated"
        outside.write_bytes(b"preserve")
        self.auth.unlink()
        self.auth.symlink_to(outside)
        with self.assertRaises(OSError):
            self.authorize()
        self.assertEqual(outside.read_bytes(), b"preserve")

    def test_symlink_ssh_directory_refused(self):
        self.auth.unlink()
        self.ssh.rmdir()
        outside = self.root / "different"
        outside.mkdir(mode=0o700)
        self.ssh.symlink_to(outside, target_is_directory=True)
        with self.assertRaises(ValueError):
            self.authorize()
        self.assertFalse((outside / "authorized_keys").exists())

    def test_unsafe_permissions_refused(self):
        self.auth.chmod(0o666)
        with self.assertRaises(ValueError):
            self.authorize()
        self.assertEqual(self.auth.read_bytes(), self.original)

    def test_hardlinked_authorized_keys_refused(self):
        os.link(self.auth, self.root / "another-name")
        with self.assertRaises(ValueError):
            self.authorize()
        self.assertEqual(self.auth.read_bytes(), self.original)

    def test_invalid_key_or_comment_cannot_add_options(self):
        for key in (PUBLIC_KEY + " extra", PUBLIC_KEY.replace("nong-code-readonly-fixture", 'unsafe,command="sh"'),
                    PUBLIC_KEY.replace("ssh-ed25519", "ssh-rsa", 1)):
            with self.subTest(key=key):
                with self.assertRaises(ValueError):
                    self.authorize(key)
                self.assertEqual(self.auth.read_bytes(), self.original)


if __name__ == "__main__":
    unittest.main()
