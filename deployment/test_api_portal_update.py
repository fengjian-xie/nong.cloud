import hashlib
import io
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import update_api_portal as deploy


class ApiUpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def bundle(self):
        path = self.root / 'api.tar.gz'
        with tarfile.open(path, 'w:gz') as archive:
            for name, data in [('dist/index.html', '<title>乡桥API开放平台</title>'.encode()), ('dist/assets/main.js', b'api-demo')]:
                member = tarfile.TarInfo(name)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
        return path

    def test_failed_readiness_restores_link_without_modifying_config(self):
        base = self.root / 'api'
        previous = base / 'releases/previous'
        previous.mkdir(parents=True)
        (previous / 'index.html').write_bytes(b'previous-docs')
        (base / 'current').symlink_to(previous)
        config = self.root / 'api.conf'
        original = ('root ' + str(base / 'current') + '; return 503;').encode()
        config.write_bytes(original)
        bundle = self.bundle()
        argv = ['update', '--bundle', str(bundle), '--sha256', hashlib.sha256(bundle.read_bytes()).hexdigest(), '--config-sha256', hashlib.sha256(original).hexdigest()]
        with patch.object(deploy, 'BASE', base), patch.object(deploy, 'CONFIG', config), \
             patch.object(deploy, 'BACKUPS', self.root / 'backups'), patch.object(deploy, 'protected', return_value={}), \
             patch.object(deploy.os, 'geteuid', return_value=0), \
             patch.object(deploy.subprocess, 'check_output', return_value=b'503'), \
             patch.object(deploy, 'wait_for_output', side_effect=RuntimeError('readiness failure')), patch('sys.argv', argv):
            with self.assertRaisesRegex(RuntimeError, 'readiness failure'):
                deploy.main()
        self.assertEqual((base / 'current').resolve(), previous.resolve())
        self.assertEqual(config.read_bytes(), original)
        self.assertEqual((base / 'current/index.html').read_bytes(), b'previous-docs')

    def test_invalid_bundle_checksum_changes_nothing(self):
        bundle = self.bundle()
        argv = ['update', '--bundle', str(bundle), '--sha256', '0' * 64, '--config-sha256', '0' * 64]
        with patch.object(deploy, 'BASE', self.root / 'missing'), patch.object(deploy.os, 'geteuid', return_value=0), patch('sys.argv', argv):
            with self.assertRaisesRegex(SystemExit, 'checksum'):
                deploy.main()
        self.assertFalse((self.root / 'missing').exists())


if __name__ == '__main__':
    unittest.main()
