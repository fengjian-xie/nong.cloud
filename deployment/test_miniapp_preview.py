import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path
import miniapp_preview as preview


class PreviewDeployTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def bundle(self, extra=None, symlink=False):
        target = self.root / 'preview.tar.gz'
        files = {'prototype/index.html': '<title>乡桥小程序交互原型</title>非微信真机<script src="preview/runtime.js"></script>'.encode(),
                 'prototype/source-bundle.json': json.dumps({'config': {'pages': ['pages/index/index']}, 'files': {'pages/index/index.wxml': '<view/>'}}).encode(),
                 **{'prototype/preview/' + name: b'public-demo' for name in preview.PREVIEW_FILES}, 'prototype/assets/icon.png': b'photo'}
        if extra: files[extra] = b'bad'
        with tarfile.open(target, 'w:gz') as archive:
            for name, data in files.items():
                member = tarfile.TarInfo(name); member.size = len(data)
                if symlink and name == extra:
                    member.type = tarfile.SYMTYPE; member.linkname = '/etc/passwd'; member.size = 0
                    archive.addfile(member)
                else: archive.addfile(member, io.BytesIO(data))
        return target

    def test_public_static_files_extract_without_node_server(self):
        destination = self.root / 'good'
        preview.extract(self.bundle(), destination)
        self.assertTrue((destination / 'source-bundle.json').is_file())
        self.assertFalse((destination / 'preview/server.cjs').exists())
        self.assertEqual((destination / 'index.html').stat().st_mode & 0o777, 0o644)

    def test_links_traversal_and_private_server_files_rejected(self):
        for i, entry in enumerate(['prototype/../escape', '/etc/passwd', 'prototype/preview/server.cjs', 'prototype/private/key', 'prototype/preview/runtime.js/nested']):
            with self.subTest(entry=entry), self.assertRaises(RuntimeError):
                preview.extract(self.bundle(entry), self.root / ('bad' + str(i)))
        with self.assertRaises(RuntimeError): preview.extract(self.bundle('prototype/assets/link', True), self.root / 'link')

    def test_destination_not_overwritten(self):
        destination = self.root / 'existing'; destination.mkdir()
        with self.assertRaises(RuntimeError): preview.extract(self.bundle(), destination)

    def test_readiness_requests_only_approved_prefix(self):
        destination = self.root / 'good'; preview.extract(self.bundle(), destination)
        calls = []
        preview.verify(destination, lambda domain, route: [domain, route], lambda command, body: calls.append((command, body)))
        self.assertTrue(calls)
        self.assertTrue(all(command[0] == 'work.nong.cloud' and command[1].startswith('/miniapp-preview/') for command, _ in calls))


if __name__ == '__main__': unittest.main()
