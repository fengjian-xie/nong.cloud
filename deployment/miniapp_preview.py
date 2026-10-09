"""Safe extraction and readiness checks for the separately approved static UI demo."""
import json
import re
import tarfile
from pathlib import Path, PurePosixPath

PREFIX = '/miniapp-preview/'
PREVIEW_FILES = {'shell.css', 'choice-menu.css', 'choice-menu.js', 'runtime.js'}


def extract(bundle, destination):
    destination = Path(destination)
    if destination.exists() or destination.is_symlink():
        raise RuntimeError('Prototype destination already exists')
    destination.mkdir(mode=0o755)
    with tarfile.open(bundle, 'r:gz') as archive:
        seen = set()
        for member in archive.getmembers():
            parts = PurePosixPath(member.name).parts
            if not parts or parts[0] != 'prototype' or '..' in parts or not (member.isdir() or member.isfile()):
                raise RuntimeError('Unsafe prototype archive entry')
            relative = parts[1:]
            if not relative:
                continue
            if relative in seen or relative[0] not in ('index.html', 'source-bundle.json', 'preview', 'assets'):
                raise RuntimeError('Unexpected/duplicate prototype entry')
            if relative[0] in ('index.html', 'source-bundle.json') and (len(relative) != 1 or not member.isfile()):
                raise RuntimeError('Invalid prototype document')
            if relative[0] == 'preview' and (len(relative) > 2 or (len(relative) == 2 and relative[1] not in PREVIEW_FILES)):
                raise RuntimeError('Server/private files forbidden in static preview')
            seen.add(relative)
            target = destination.joinpath(*relative)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True, mode=0o755)
            else:
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                with archive.extractfile(member) as source:
                    target.write_bytes(source.read())
                target.chmod(0o644)
    html = (destination / 'index.html').read_text()
    if '<title>乡桥小程序交互原型</title>' not in html or '非微信真机' not in html:
        raise RuntimeError('Prototype identity/demo label missing')
    if re.search(r'(?:src|href)="/', html):
        raise RuntimeError('Root resource paths are forbidden')
    for name in PREVIEW_FILES:
        if not (destination / 'preview' / name).is_file():
            raise RuntimeError('Missing preview resource')
    data = json.loads((destination / 'source-bundle.json').read_text())
    if not data['config']['pages'] or not all(page + '.wxml' in data['files'] for page in data['config']['pages']):
        raise RuntimeError('Registered native-page templates missing')
    for directory in destination.rglob('*'):
        if directory.is_dir(): directory.chmod(0o755)


def verify(destination, curl, wait):
    for path in sorted(Path(destination).rglob('*')):
        if path.is_file():
            relative = path.relative_to(destination).as_posix()
            wait(curl('work.nong.cloud', PREFIX + relative) + ['--fail'], path.read_bytes())
    wait(curl('work.nong.cloud', PREFIX) + ['--fail'], (Path(destination) / 'index.html').read_bytes())
