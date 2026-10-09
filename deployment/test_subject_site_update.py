import hashlib
import io
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import update_subject_site as deploy


class SubjectUpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.addCleanup(self.temp.cleanup)
        self.base = self.root / 'site'
        self.previous = self.base / 'releases/previous'
        self.previous.mkdir(parents=True)
        (self.previous / 'index.html').write_bytes(b'previous-site')
        (self.base / 'current').symlink_to(self.previous)
        self.config = self.root / 'nginx/conf.d/nc.nong.cloud.conf'
        self.config.parent.mkdir(parents=True)
        self.original = ('server_name nc.nong.cloud;\nserver_name nc.nong.cloud;\nroot ' + str(self.base / 'current') + ';\nlocation ~ ^/api(/|$) { return 503; }').encode()
        self.config.write_bytes(self.original)

    def bundle(self):
        target = self.root / 'farm.tar.gz'
        files = {'dist/index.html': b'<title>nc.nong.cloud</title><script src="/assets/main.js"></script>', 'dist/assets/main.js': b'demo', 'dist/brand/favicon.svg': b'<svg/>', 'dist/brand/fuan-vineyard.jpg': b'photo', 'dist/brand/fuan-grapes.jpg': b'grapes'}
        with tarfile.open(target, 'w:gz') as archive:
            for name, data in files.items():
                member = tarfile.TarInfo(name)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
        return target

    def test_owner_rejects_foreign_current_or_config(self):
        checksum = hashlib.sha256(self.original).hexdigest()
        self.assertEqual(deploy.validate_owner(self.base, self.config, 'nc.nong.cloud', checksum), self.previous)
        with self.assertRaises(RuntimeError):
            deploy.validate_owner(self.base, self.config, 'work.nong.cloud', checksum)
        (self.base / 'current').unlink()
        (self.base / 'current').symlink_to(self.root)
        with self.assertRaises(RuntimeError):
            deploy.validate_owner(self.base, self.config, 'nc.nong.cloud', checksum)

    def test_failed_readiness_restores_link_preserves_config(self):
        bundle = self.bundle()
        argv = ['update', '--site', 'farm', '--bundle', str(bundle), '--sha256', hashlib.sha256(bundle.read_bytes()).hexdigest(), '--config-sha256', hashlib.sha256(self.original).hexdigest()]
        with patch.dict(deploy.SITES, {'farm': ('nc.nong.cloud', self.base, self.root / 'backups')}), patch.object(deploy, 'NGINX', self.root / 'nginx'), patch.object(deploy.os, 'geteuid', return_value=0), patch.object(deploy.subprocess, 'run'), patch.object(deploy.subprocess, 'check_output', side_effect=lambda args: b'401' if 'https://nong.cloud/api/v1/' in args else b'503'), patch.object(deploy, 'wait_for_output', side_effect=RuntimeError('readiness failure')), patch.object(deploy.installer, 'DOMAIN', 'nc.nong.cloud'), patch('sys.argv', argv):
            with self.assertRaisesRegex(RuntimeError, 'readiness failure'):
                deploy.main()
        self.assertEqual((self.base / 'current').resolve(), self.previous)
        self.assertEqual(self.config.read_bytes(), self.original)
        self.assertTrue(list((self.root / 'backups').glob('*/deployment.json')) == [])
        self.assertTrue(list((self.root / 'backups').glob('*/nc.nong.cloud.conf')))

    def test_checksum_failure_changes_nothing(self):
        bundle = self.bundle()
        with patch.object(deploy.os, 'geteuid', return_value=0), patch('sys.argv', ['update', '--site', 'farm', '--bundle', str(bundle), '--sha256', '0' * 64, '--config-sha256', '0' * 64]):
            with self.assertRaises(SystemExit):
                deploy.main()
        self.assertEqual((self.base / 'current').resolve(), self.previous)

    def test_prototype_location_is_bounded_and_preserves_all_other_config(self):
        original = self.original.decode().replace('nc.nong.cloud', 'work.nong.cloud') + '\n    location ^~ /assets/ { try_files $uri =404; }\nssl_certificate unchanged;\n'
        updated = deploy.prototype_config(original)
        self.assertIn('location ^~ /miniapp-preview/', updated)
        self.assertIn('try_files $uri $uri/ =404;', updated)
        self.assertEqual(updated.replace(deploy.PROTOTYPE_BLOCK, '', 1), original)
        self.assertEqual(deploy.prototype_config(updated), updated)
        for text in [original.replace('work.nong.cloud', 'nc.nong.cloud'), original + 'location /miniapp-preview/ { proxy_pass http://other; }']:
            with self.assertRaises(RuntimeError): deploy.prototype_config(text)

    def test_prototype_arguments_cannot_change_farm(self):
        with patch('sys.argv', ['update', '--site', 'farm', '--bundle', '/unused', '--sha256', '0'*64, '--config-sha256', '0'*64, '--prototype-bundle', '/unused', '--prototype-sha256', '0'*64]):
            with self.assertRaisesRegex(SystemExit, 'work only'): deploy.main()


if __name__ == '__main__':
    unittest.main()
