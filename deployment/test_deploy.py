import hashlib
import json
import re
from pathlib import Path
import unittest

from deploy import candidate_config, MARKER

ORIGINAL = '''server {
server_name m.nong.cloud;
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    client_max_body_size 30m;
}
listen 443 ssl;
ssl_certificate /etc/letsencrypt/live/m.nong.cloud/fullchain.pem;
}
server {
server_name m.nong.cloud;
listen 80;
return 301 https://$host$request_uri;
}
'''


class DeploymentTests(unittest.TestCase):
    def test_only_inserts_frontend_locations(self):
        updated = candidate_config(ORIGINAL, Path('/var/www/fuan-releases/test'))
        original_start = ORIGINAL.index('location / {')
        updated_start = updated.index('location / {')
        self.assertEqual(updated[updated_start:], ORIGINAL[original_start:])
        self.assertEqual(updated.count('proxy_pass'), 1)
        self.assertIn('location ^~ /fuan-ui/assets/', updated)
        self.assertIn('try_files /index.html =404;', updated)
        self.assertEqual(updated.count('{'), updated.count('}'))

    def test_homepage_serves_file_without_directory_index_alias(self):
        updated = candidate_config(ORIGINAL, Path('/var/www/fuan-releases/test'))
        homepage = re.search(r'location = / \{([^}]+)\}', updated).group(1)
        self.assertIn('root /var/www/fuan-releases/test;', homepage)
        self.assertIn('try_files /index.html =404;', homepage)
        self.assertNotIn('alias', homepage)

    def test_rejects_unknown_layouts(self):
        for changed in [ORIGINAL.replace('m.nong.cloud', 'nong.cloud'),
                        ORIGINAL.replace(':8080;', ':8081;'),
                        ORIGINAL.replace('location /', 'location /api/'),
                        ORIGINAL + '\nlocation /extra { return 200; }',
                        ORIGINAL + MARKER,
                        ORIGINAL.replace('listen 443 ssl;', 'listen 80;')]:
            with self.subTest(config=changed):
                with self.assertRaises(RuntimeError):
                    candidate_config(changed, Path('/var/www/fuan-releases/test'))

    def test_build_matches_manifest(self):
        directory = Path(__file__).resolve().parent
        site = directory.parent / 'admin-web' / 'release-site'
        manifest = json.loads((directory / 'manifest.json').read_text())
        self.assertEqual(set(manifest), {p.relative_to(site).as_posix() for p in site.rglob('*') if p.is_file()})
        for name, digest in manifest.items():
            self.assertEqual(hashlib.sha256((site / name).read_bytes()).hexdigest(), digest)
        self.assertIn('/fuan-ui/assets/', (site / 'index.html').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
