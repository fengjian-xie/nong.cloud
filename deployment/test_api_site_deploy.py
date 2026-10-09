import hashlib
import io
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import deploy_api_site as deploy


class ApiSiteDeployTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def bundle(self, name='dist/index.html', kind=None):
        path = self.root / 'release.tar.gz'
        with tarfile.open(path, 'w:gz') as archive:
            member = tarfile.TarInfo(name)
            if kind:
                member.type = kind
                member.linkname = '/etc/passwd'
                archive.addfile(member)
            else:
                data = '<title>乡桥API开放平台</title>'.encode()
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
        return path

    def test_extract_valid_api_build(self):
        release = self.root / 'output'
        deploy.extract_dist(self.bundle(), release)
        self.assertIn('乡桥API开放平台', (release / 'index.html').read_text())
        self.assertEqual((release / 'index.html').stat().st_mode & 0o777, 0o644)

    def test_reject_archive_traversal(self):
        with self.assertRaisesRegex(RuntimeError, 'Unsafe'):
            deploy.extract_dist(self.bundle('dist/../../escape'), self.root / 'output')
        self.assertFalse((self.root.parent / 'escape').exists())

    def test_reject_archive_symlink(self):
        with self.assertRaisesRegex(RuntimeError, 'Unsafe'):
            deploy.extract_dist(self.bundle(kind=tarfile.SYMTYPE), self.root / 'output')

    def test_atomic_write_permissions(self):
        path = self.root / 'state.json'
        deploy.atomic_write(path, b'{}', 0o600)
        self.assertEqual(path.read_bytes(), b'{}')
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(list(self.root.glob('.state.json-*')), [])

    def test_certificate_failure_restores_api_only(self):
        base = self.root / 'portal'
        config = self.root / 'nginx/api.nong.cloud.conf'
        config.parent.mkdir()
        other = config.parent / 'm.nong.cloud.conf'
        other.write_bytes(b'original-admin-config')
        bundle = self.bundle()
        template = self.root / 'template'
        template.write_text('server_name api.nong.cloud; root ' + str(base) + ';')
        argv = ['deploy', '--bundle', str(bundle), '--sha256', hashlib.sha256(bundle.read_bytes()).hexdigest(),
                '--http-template', str(template), '--tls-template', str(template)]

        def run(*args):
            if args[0] == 'certbot':
                raise RuntimeError('certificate issuance failed')

        def output(args, **kwargs):
            return b'' if args[0] == 'nginx' else b'xiangqiao-api-http01-ready\n'

        with patch.object(deploy, 'BASE', base), patch.object(deploy, 'CONFIG', config), \
             patch.object(deploy, 'BACKUPS', self.root / 'backups'), \
             patch.object(deploy, 'nginx_fingerprints', return_value={}), \
             patch.object(deploy, 'run', side_effect=run), \
             patch.object(deploy.subprocess, 'check_output', side_effect=output), \
             patch.object(deploy.os, 'geteuid', return_value=0), patch('sys.argv', argv):
            with self.assertRaisesRegex(RuntimeError, 'certificate issuance failed'):
                deploy.main()
        self.assertFalse(config.exists())
        self.assertFalse((base / 'current').is_symlink())
        self.assertEqual(other.read_bytes(), b'original-admin-config')
        self.assertTrue(list((base / 'releases').glob('*/index.html')))
        self.assertTrue(list((self.root / 'backups').glob('*/protected-sha256.json')))

    def test_invalid_checksum_changes_nothing(self):
        base = self.root / 'portal'
        bundle = self.bundle()
        argv = ['deploy', '--bundle', str(bundle), '--sha256', '0' * 64,
                '--http-template', '/missing', '--tls-template', '/missing']
        with patch.object(deploy, 'BASE', base), patch.object(deploy.os, 'geteuid', return_value=0), \
             patch('sys.argv', argv), patch.object(deploy, 'run') as run:
            with self.assertRaisesRegex(SystemExit, 'checksum mismatch'):
                deploy.main()
            run.assert_not_called()
        self.assertFalse(base.exists())

    def test_reload_readiness_retries_transient_failure(self):
        responses = [subprocess.CalledProcessError(22, ['curl']), b'ready']
        with patch.object(deploy.subprocess, 'check_output', side_effect=responses) as check, \
             patch.object(deploy.time, 'sleep') as sleep:
            deploy.wait_for_output(['curl'], b'ready')
        self.assertEqual(check.call_count, 2)
        sleep.assert_called_once_with(0.5)


if __name__ == '__main__':
    unittest.main()
