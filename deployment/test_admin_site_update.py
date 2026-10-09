import hashlib
import io
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import update_admin_site as deploy


def original_config(release='/var/www/fuan-releases/old'):
    return '''server {
    server_name m.nong.cloud;
    # FUAN FRONTEND MANAGED RELEASE
    location = / {
        root ROOTPATH;
        try_files /index.html =404;
    }
    location ^~ /fuan-ui/assets/ {
        alias ROOTPATH/assets/;
    }
    location ~ ^/(login|members|tasks|plots|services|supply|config|settings|audit)(/|$) {
        root ROOTPATH;
        try_files /index.html =404;
    }
    location / {
        proxy_pass http://127.0.0.1:8080;
        client_max_body_size 30m;
    }
    ssl_certificate /original/cert.pem;
}
server {
    server_name m.nong.cloud;
    return 301 https://$host$request_uri;
}
'''.replace('ROOTPATH', release)


class AdminUpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def bundle(self, extra=None):
        path = self.root / 'admin.tar.gz'
        files = {'dist/index.html': '<title>福安管理后台</title><script src="/fuan-ui/assets/main.js"></script>'.encode(),
                 'dist/assets/main.js': b'admin-demo', 'dist/brand/favicon.svg': b'<svg/>'}
        if extra:
            files[extra] = b'bad'
        with tarfile.open(path, 'w:gz') as archive:
            for name, data in files.items():
                member = tarfile.TarInfo(name)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
        return path

    def test_only_managed_ui_changes(self):
        original = original_config()
        proposed, previous = deploy.updated_config(original, Path('/var/www/fuan-releases/new'))
        self.assertEqual(previous, '/var/www/fuan-releases/old')
        self.assertEqual(proposed[proposed.index('    location / {'):], original[original.index('    location / {'):])
        self.assertIn('|cards|records|', proposed)
        self.assertIn('|workspace|open-api', proposed)
        self.assertIn('|open-api|manage)(/|$)', proposed)
        self.assertNotIn('|api|', proposed)
        self.assertIn('alias /var/www/fuan-releases/new/brand/;', proposed)
        again, previous = deploy.updated_config(proposed, Path('/var/www/fuan-releases/again'))
        self.assertEqual(previous, '/var/www/fuan-releases/new')
        self.assertEqual(again.count('location ^~ /fuan-ui/brand/'), 1)
        self.assertNotIn('/var/www/fuan-releases/new', again)
        self.assertEqual(again[again.index('    location / {'):], original[original.index('    location / {'):])

    def test_upgrade_pre_v4_whitelist_preserves_backend_and_tls(self):
        current, _ = deploy.updated_config(original_config(), Path('/var/www/fuan-releases/current'))
        shipped = current.replace(deploy.ROUTES, deploy.PREVIOUS_ROUTES)
        proposed, previous = deploy.updated_config(shipped, Path('/var/www/fuan-releases/v4'))
        self.assertEqual(previous, '/var/www/fuan-releases/current')
        self.assertIn('^/(' + deploy.ROUTES + ')(/|$)', proposed)
        self.assertEqual(proposed[proposed.index('    location / {'):], shipped[shipped.index('    location / {'):])
        self.assertNotIn('/var/www/fuan-releases/current', proposed)
        self.assertEqual(proposed.count('location ^~ /fuan-ui/brand/'), 1)

    def test_manage_prefix_does_not_broaden_api_or_other_routes(self):
        proposed, _ = deploy.updated_config(original_config(), Path('/var/www/fuan-releases/new'))
        import re
        pattern = '^/(' + deploy.ROUTES + ')(/|$)'
        for route in ['/manage', '/manage/production/plots', '/manage/finance/settlement']:
            self.assertRegex(route, pattern)
        for route in ['/api/v1/plots', '/manage-extra', '/management', '/private']:
            self.assertIsNone(re.search(pattern, route))
        with self.assertRaises(RuntimeError):
            deploy.updated_config(proposed.replace('|manage', '|manage|api'), Path('/var/www/fuan-releases/again'))

    def test_unknown_route_or_mixed_release_is_rejected(self):
        proposed, _ = deploy.updated_config(original_config(), Path('/var/www/fuan-releases/new'))
        for text in (proposed.replace('|open-api', '|unknown'), proposed.replace('alias /var/www/fuan-releases/new/brand/', 'alias /var/www/fuan-releases/other/brand/')):
            with self.subTest(text=text), self.assertRaises(RuntimeError):
                deploy.updated_config(text, Path('/var/www/fuan-releases/again'))

    def test_extract_only_frontend(self):
        deploy.extract_dist(self.bundle(), self.root / 'good')
        self.assertTrue((self.root / 'good/assets/main.js').is_file())
        for name in ('dist/../../escape', '/etc/passwd', 'dist/private/key'):
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                deploy.extract_dist(self.bundle(name), self.root / 'bad')

    def test_failed_readiness_restores_only_admin_config(self):
        base = self.root / 'releases'
        previous = base / 'old'
        previous.mkdir(parents=True)
        (previous / 'index.html').write_bytes(b'previous-ui')
        config = self.root / 'nginx/m.nong.cloud.conf'
        config.parent.mkdir()
        original = original_config(str(previous)).encode()
        config.write_bytes(original)
        other = config.parent / 'nc.nong.cloud.conf'
        other.write_bytes(b'keep-farm')
        bundle = self.bundle()
        argv = ['update', '--bundle', str(bundle), '--sha256', hashlib.sha256(bundle.read_bytes()).hexdigest(),
                '--config-sha256', hashlib.sha256(original).hexdigest()]
        # Only the known release-reference parser is path-specific in production.
        with patch.object(deploy, 'BASE', base), patch.object(deploy, 'CONFIG', config), \
             patch.object(deploy, 'BACKUPS', self.root / 'backups'), \
             patch.object(deploy, 'updated_config', return_value=(original.decode().replace(str(previous), str(base / 'new')), str(previous))), \
             patch.object(deploy, 'fingerprints', return_value={}), patch.object(deploy, 'run'), \
             patch.object(deploy.subprocess, 'check_output', side_effect=lambda args: b'401' if '-w' in args else b'other-site'), \
             patch.object(deploy, 'wait_for_output', side_effect=RuntimeError('readiness failure')), \
             patch.object(deploy.os, 'geteuid', return_value=0), patch('sys.argv', argv):
            with self.assertRaisesRegex(RuntimeError, 'readiness failure'):
                deploy.main()
        self.assertEqual(config.read_bytes(), original)
        self.assertEqual(other.read_bytes(), b'keep-farm')
        self.assertEqual((previous / 'index.html').read_bytes(), b'previous-ui')
        self.assertTrue(list((self.root / 'backups').glob('*/m.nong.cloud.conf')))


if __name__ == '__main__':
    unittest.main()
