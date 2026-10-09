import hashlib
import io
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import deploy_cloud_farm as deploy


class CloudFarmDeployTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def bundle(self, extra=None):
        path = self.root / 'farm.tar.gz'
        files = {'dist/index.html': b'<title>nc.nong.cloud</title><script src="/assets/main.js"></script>',
                 'dist/assets/main.js': b'farm-demo', 'dist/brand/fuan-grapes.jpg': b'grapes',
                 'dist/brand/fuan-vineyard.jpg': b'aerial', 'dist/brand/favicon.svg': b'<svg/>'}
        if extra:
            files[extra] = b'bad'
        with tarfile.open(path, 'w:gz') as archive:
            for name, value in files.items():
                member = tarfile.TarInfo(name); member.size = len(value)
                archive.addfile(member, io.BytesIO(value))
        return path

    def test_vhost_scoped_to_farm_and_missing_assets_404(self):
        tls = deploy.vhost(True).decode()
        self.assertIn('server_name nc.nong.cloud;', tls)
        self.assertIn('location ^~ /assets/', tls)
        self.assertIn('try_files $uri =404;', tls)
        self.assertIn('return 503', tls)
        self.assertNotIn('proxy_pass', tls)
        self.assertNotIn('m.nong.cloud', tls)

    def test_safe_extract_and_reject_unknown_paths(self):
        deploy.extract_dist(self.bundle(), self.root / 'good')
        self.assertTrue((self.root / 'good/assets/main.js').is_file())
        for name in ('dist/../../escape', '/etc/passwd', 'dist/private/key'):
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                deploy.extract_dist(self.bundle(name), self.root / 'bad')

    def test_work_installer_isolates_both_http_and_https_hosts(self):
        with patch.object(deploy, 'DOMAIN', 'work.nong.cloud'), patch.object(deploy, 'BASE', Path('/var/www/xiangqiao-work')):
            for tls in (False, True):
                text = deploy.vhost(tls).decode()
                self.assertIn('server_name work.nong.cloud;', text)
                self.assertIn('/var/www/xiangqiao-work', text)
                self.assertNotIn('nc.nong.cloud', text)
                self.assertNotIn('xiangqiao-cloud-farm', text)

    def test_certificate_failure_restores_only_new_farm_vhost(self):
        bundle = self.bundle()
        base = self.root / 'farm'
        config = self.root / 'nginx/nc.nong.cloud.conf'
        config.parent.mkdir()
        other = config.parent / 'nong.cloud.conf'
        other.write_bytes(b'unchanged-homepage')
        args = ['deploy', '--bundle', str(bundle), '--sha256', hashlib.sha256(bundle.read_bytes()).hexdigest()]
        def fake_run(*values):
            if values[0] == 'certbot':
                self.assertNotIn('--agree-tos', values)
                raise RuntimeError('simulated certificate failure')
        def fake_output(values, **kwargs):
            return b'401' if '-w' in values else b'existing-site'
        with patch.object(deploy, 'BASE', base), patch.object(deploy, 'CONFIG', config), \
             patch.object(deploy, 'BACKUPS', self.root / 'backups'), \
             patch.object(deploy, 'protected_fingerprints', return_value={}), \
             patch.object(deploy, 'run', side_effect=fake_run), \
             patch.object(deploy, 'wait_for_output'), \
             patch.object(deploy.subprocess, 'check_output', side_effect=fake_output), \
             patch.object(deploy.socket, 'gethostbyname', return_value='8.141.88.22'), \
             patch.object(deploy.os, 'geteuid', return_value=0), patch('sys.argv', args):
            with self.assertRaisesRegex(RuntimeError, 'simulated certificate failure'):
                deploy.main()
        self.assertFalse(config.exists())
        self.assertFalse((base / 'current').is_symlink())
        self.assertEqual(other.read_bytes(), b'unchanged-homepage')
        self.assertTrue(list((base / 'releases').glob('*/index.html')))


if __name__ == '__main__':
    unittest.main()
