import io
import tarfile
import tempfile
import unittest
import hashlib
from pathlib import Path
from unittest.mock import patch

import deploy_home_site as deploy


class HomeSiteDeployTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def bundle(self, extra=None, symlink=False, title='乡桥农场'):
        path = self.root / 'home.tar.gz'
        files = {
            'dist/index.html': ('<title>' + title + '</title><script src="/brand-site/assets/main.js"></script>').encode(),
            'dist/assets/main.js': b'console.log("home")',
            'dist/brand/fuan-grapes.jpg': b'photo',
        }
        if extra:
            files[extra] = b'unsafe'
        with tarfile.open(path, 'w:gz') as archive:
            for name, data in files.items():
                member = tarfile.TarInfo(name)
                if symlink and name == extra:
                    member.type = tarfile.SYMTYPE
                    member.linkname = '/etc/passwd'
                    archive.addfile(member)
                else:
                    member.size = len(data)
                    archive.addfile(member, io.BytesIO(data))
        return path

    def test_isolated_homepage_locations_preserve_original(self):
        original = 'server_name nong.cloud;\nroot /var/www/nong.cloud;\n    location /api/v1/ {\nproxy_pass http://127.0.0.1:8080;\n}\nlocation / { try_files $uri /index.html; }'
        result = deploy.homepage_config(original)
        self.assertIn('location = / {', result)
        self.assertIn('location ^~ /brand-site/ {', result)
        self.assertEqual(result[result.index('    location /api/v1/ {'):], original[original.index('    location /api/v1/ {'):])
        with self.assertRaisesRegex(RuntimeError, 'Unexpected'):
            deploy.homepage_config(result)

    def test_extract_mapping(self):
        release = self.root / 'release'
        deploy.extract_dist(self.bundle(), release)
        self.assertTrue((release / 'index.html').is_file())
        self.assertTrue((release / 'brand-site/assets/main.js').is_file())
        self.assertTrue((release / 'brand-site/brand/fuan-grapes.jpg').is_file())
        self.assertEqual((release / 'index.html').stat().st_mode & 0o777, 0o644)

    def test_path_traversal_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'Unsafe'):
            deploy.extract_dist(self.bundle('dist/../../escape'), self.root / 'release')
        self.assertFalse((self.root.parent / 'escape').exists())

    def test_renamed_center_homepage_title_accepted(self):
        deploy.extract_dist(self.bundle(title='乡桥农事中心 · 官网'), self.root / 'renamed')
        self.assertIn('乡桥农事中心', (self.root / 'renamed/index.html').read_text())
        with self.assertRaisesRegex(RuntimeError, 'Not a homepage'):
            deploy.extract_dist(self.bundle(title='管理后台'), self.root / 'not-home')

    def test_symlink_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'Unsafe'):
            deploy.extract_dist(self.bundle('dist/brand/link', True), self.root / 'release')

    def test_unexpected_folder_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'Unexpected'):
            deploy.extract_dist(self.bundle('dist/private/key'), self.root / 'release')

    def test_atomic_current_switch(self):
        current = self.root / 'current'
        old = self.root / 'old'
        new = self.root / 'new'
        old.mkdir(); new.mkdir()
        current.symlink_to(old)
        deploy.switch_current(current, new, 'test')
        self.assertEqual(current.resolve(), new.resolve())
        self.assertEqual(list(self.root.glob('.current-*')), [])
        deploy.switch_current(current, old, 'rollback')
        self.assertEqual(current.resolve(), old.resolve())

    def test_activation_failure_rolls_back_only_homepage(self):
        config = self.root / 'nginx/nong.cloud.conf'
        config.parent.mkdir()
        original = b'server_name nong.cloud;\nroot /var/www/nong.cloud;\n    location /api/v1/ { proxy_pass http://127.0.0.1:8080; }'
        config.write_bytes(original)
        other = config.parent / 'api.nong.cloud.conf'
        other.write_bytes(b'keep-api')
        base = self.root / 'homepage'
        bundle = self.bundle()
        argv = ['deploy', '--bundle', str(bundle), '--sha256', hashlib.sha256(bundle.read_bytes()).hexdigest(),
                '--config-sha256', hashlib.sha256(original).hexdigest()]
        reloads = []

        def fake_run(*args):
            if args[:2] == ('systemctl', 'reload'):
                reloads.append(args)
                if len(reloads) == 1:
                    raise RuntimeError('simulated reload failure')

        def fake_output(args, **kwargs):
            return b'401' if '-w' in args else b'unchanged-other-homepage'

        with patch.object(deploy, 'BASE', base), patch.object(deploy, 'CONFIG', config), \
             patch.object(deploy, 'BACKUPS', self.root / 'backups'), \
             patch.object(deploy, 'protected_fingerprints', return_value={}), \
             patch.object(deploy, 'run', side_effect=fake_run), \
             patch.object(deploy.subprocess, 'check_output', side_effect=fake_output), \
             patch.object(deploy.os, 'geteuid', return_value=0), patch('sys.argv', argv):
            with self.assertRaisesRegex(RuntimeError, 'simulated reload failure'):
                deploy.main()
        self.assertEqual(config.read_bytes(), original)
        self.assertEqual(other.read_bytes(), b'keep-api')
        self.assertFalse((base / 'current').is_symlink())
        self.assertTrue(list((base / 'releases').glob('*/index.html')))
        self.assertTrue(list((self.root / 'backups').glob('*/nong.cloud.conf')))
        self.assertEqual(len(reloads), 2)

    def test_failed_update_restores_previous_release_and_config(self):
        config = self.root / 'nginx/nong.cloud.conf'
        config.parent.mkdir()
        original = deploy.homepage_config('server_name nong.cloud;\nroot /var/www/nong.cloud;\n    location /api/v1/ { proxy_pass http://127.0.0.1:8080; }').encode()
        config.write_bytes(original)
        base = self.root / 'homepage'
        previous = base / 'releases/old'
        previous.mkdir(parents=True)
        (previous / 'index.html').write_bytes(b'previous-homepage')
        (base / 'current').symlink_to(previous)
        bundle = self.bundle()
        argv = ['deploy', '--update', '--bundle', str(bundle), '--sha256', hashlib.sha256(bundle.read_bytes()).hexdigest(),
                '--config-sha256', hashlib.sha256(original).hexdigest()]

        with patch.object(deploy, 'BASE', base), patch.object(deploy, 'CONFIG', config), \
             patch.object(deploy, 'BACKUPS', self.root / 'backups'), \
             patch.object(deploy, 'protected_fingerprints', return_value={}), \
             patch.object(deploy, 'run'), \
             patch.object(deploy.subprocess, 'check_output', side_effect=lambda args: b'401' if '-w' in args else b'other-site'), \
             patch.object(deploy, 'wait_for_output', side_effect=RuntimeError('simulated readiness failure')), \
             patch.object(deploy.os, 'geteuid', return_value=0), patch('sys.argv', argv):
            with self.assertRaisesRegex(RuntimeError, 'simulated readiness failure'):
                deploy.main()
        self.assertEqual((base / 'current').resolve(), previous.resolve())
        self.assertEqual((base / 'current/index.html').read_bytes(), b'previous-homepage')
        self.assertEqual(config.read_bytes(), original)
        self.assertEqual(list(base.glob('.current-*')), [])


if __name__ == '__main__':
    unittest.main()
