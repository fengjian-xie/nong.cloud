import base64
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
import authorize_web_release as auth


class WebAuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name); self.directory.chmod(0o700)
        self.path = self.directory / 'authorized_keys'
        self.before = b'# keep\r\nssh-ed25519 ORIGINAL another-key'
        self.path.write_bytes(self.before); self.path.chmod(0o600)
        self.label = 'xiangqiao-web-v41-20261006-test'
        self.key = b'ssh-ed25519 AAAAtest ' + self.label.encode()
        self.expiry = int(time.time()) + 3600
        self.backup = self.directory / ('authorized_keys.before-' + self.label)
        self.revoke = self.directory / ('authorized_keys.before-revoke-' + self.label)

    def grant(self):
        return auth.change(self.path, self.backup, self.key, self.expiry, expected_uid=os.getuid())

    def test_exact_append_and_idempotency(self):
        before_inode = self.path.stat().st_ino
        result = self.grant()
        self.assertEqual(result['status'], 'XIANGQIAO_WEB_AUTH_READY')
        self.assertTrue(self.path.read_bytes().startswith(self.before + b'\nrestrict,expiry-time="'))
        self.assertEqual(self.backup.read_bytes(), self.before)
        self.assertFalse(self.grant()['changed'])
        self.assertEqual(self.path.stat().st_ino, before_inode)
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)

    def test_exact_revocation_restores_original_no_final_newline(self):
        self.grant()
        auth.change(self.path, self.revoke, self.key, self.expiry, True, os.getuid())
        self.assertEqual(self.path.read_bytes(), self.before)
        self.assertFalse(auth.change(self.path, self.revoke, self.key, self.expiry, True, os.getuid())['changed'])

    def test_revoke_preserves_concurrent_other_authorization(self):
        self.grant()
        with self.path.open('ab') as handle: handle.write(b'ssh-ed25519 ANOTHER concurrent\n')
        auth.change(self.path, self.revoke, self.key, self.expiry, True, os.getuid())
        self.assertEqual(self.path.read_bytes(), self.before + b'\nssh-ed25519 ANOTHER concurrent\n')

    def test_expired_or_overlong_refused(self):
        for expires in [int(time.time()) - 1, int(time.time()) + 7201]:
            with self.assertRaises(RuntimeError):
                auth.change(self.path, self.backup, self.key, expires, expected_uid=os.getuid())
            self.assertEqual(self.path.read_bytes(), self.before)

    def test_backup_and_symlink_not_overwritten(self):
        self.backup.write_bytes(b'keep')
        with self.assertRaises(FileExistsError): self.grant()
        self.assertEqual(self.path.read_bytes(), self.before)
        link = self.directory / 'link'; link.symlink_to(self.path)
        with self.assertRaises(RuntimeError):
            auth.change(link, self.backup, self.key, self.expiry, expected_uid=os.getuid())

    def test_nonmatching_options_rejected(self):
        self.path.write_bytes(b'no-port-forwarding ' + self.key + b'\n')
        with self.assertRaises(RuntimeError): self.grant()

    def test_public_key_validation(self):
        encoded = base64.b64encode(self.key).decode()
        self.assertEqual(auth.checked_key(encoded, self.label), self.key)
        with self.assertRaises(RuntimeError): auth.checked_key(encoded, 'other')

    def test_expiry_uses_server_timezone(self):
        with patch.dict(os.environ, {'TZ': 'Asia/Shanghai'}):
            time.tzset()
            try:
                self.grant()
                self.assertIn(time.strftime('%Y%m%d%H%M%S', time.localtime(self.expiry)).encode(), self.path.read_bytes())
            finally:
                os.environ.pop('TZ', None); time.tzset()


if __name__ == '__main__': unittest.main()
