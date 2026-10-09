"""Publish only nong.cloud's homepage and /brand-site/ assets.

Preserve all legacy routes, /api/v1/, old static assets and other vhosts.
Reuse the existing certificate. Authorization is handled outside this script.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tarfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

from deploy_api_site import atomic_write, wait_for_output

BASE = Path('/var/www/xiangqiao-home')
CONFIG = Path('/etc/nginx/conf.d/nong.cloud.conf')
BACKUPS = Path('/var/backups/xiangqiao-home')
MARKER = '# xiangqiao-home: isolated homepage'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args):
    subprocess.run(args, check=True)


def protected_fingerprints():
    paths = [p for p in Path('/etc/nginx').rglob('*.conf') if p.is_file() and p != CONFIG]
    paths.extend([Path('/var/www/nong.cloud/index.html'), Path('/var/www/xiangqiao-api/join.php')])
    return {str(p): sha(p) for p in sorted(paths) if p.is_file()}


def homepage_config(original):
    # Refuse to rewrite an already-published or unexpected virtual host.
    if MARKER in original or original.count('    location /api/v1/ {') != 1:
        raise RuntimeError('Unexpected homepage vhost; inspect before deployment')
    if 'server_name nong.cloud;' not in original or 'root /var/www/nong.cloud;' not in original:
        raise RuntimeError('Not the expected nong.cloud legacy vhost')
    locations = '''    # xiangqiao-home: isolated homepage
    location = / {
        root /var/www/xiangqiao-home/current;
        try_files /index.html =404;
        add_header Cache-Control "no-store" always;
    }

    location ^~ /brand-site/ {
        root /var/www/xiangqiao-home/current;
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control "public";
    }

'''
    return original.replace('    location /api/v1/ {', locations + '    location /api/v1/ {', 1)


def extract_dist(bundle, release):
    with tarfile.open(bundle, 'r:gz') as archive:
        members = archive.getmembers()
        seen = set()
        for member in members:
            parts = PurePosixPath(member.name).parts
            if not parts or parts[0] != 'dist' or '..' in parts or not (member.isdir() or member.isfile()):
                raise RuntimeError('Unsafe archive member')
            relative = parts[1:]
            if not relative:
                continue
            if relative[0] not in ('index.html', 'assets', 'brand'):
                raise RuntimeError('Unexpected homepage asset directory')
            key = '/'.join(relative)
            if key in seen:
                raise RuntimeError('Duplicate archive member')
            seen.add(key)
            target = release.joinpath(*relative) if relative == ('index.html',) else release.joinpath('brand-site', *relative)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True, mode=0o755)
                target.chmod(0o755)
            else:
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                with archive.extractfile(member) as source:
                    target.write_bytes(source.read())
                target.chmod(0o644)
    index = release / 'index.html'
    document = index.read_text() if index.is_file() else ''
    title = re.search(r'<title>([^<]+)</title>', document)
    if not title or not title.group(1).startswith(('乡桥农场', '乡桥农事中心')) or '/brand-site/assets/' not in document:
        raise RuntimeError('Not a homepage-mode build')
    references = re.findall(r'(?:src|href)="(/brand-site/assets/[^"?]+)"', index.read_text())
    if not references or any(not release.joinpath(ref.lstrip('/')).is_file() for ref in references):
        raise RuntimeError('Missing entry assets')
    if not (release / 'brand-site/brand/fuan-grapes.jpg').is_file():
        raise RuntimeError('Missing grape photograph')
    for directory in release.rglob('*'):
        if directory.is_dir():
            directory.chmod(0o755)


def curl_args(domain, path='/'):
    return ['curl', '--silent', '--show-error', '--max-time', '10', '--noproxy', '*',
            '--resolve', domain + ':443:127.0.0.1', 'https://' + domain + path]


def switch_current(current, target, stamp):
    temporary = current.parent / ('.current-' + stamp)
    if temporary.exists() or temporary.is_symlink():
        raise RuntimeError('Unexpected temporary current link')
    temporary.symlink_to(target)
    try:
        os.replace(temporary, current)
    finally:
        if temporary.is_symlink():
            temporary.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--config-sha256', required=True)
    parser.add_argument('--update', action='store_true', help='Update an inspected existing homepage release')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Root required')
    if not re.fullmatch('[0-9a-f]{64}', args.sha256) or sha(args.bundle) != args.sha256:
        raise SystemExit('Bundle checksum mismatch; nothing changed')
    if BASE.is_symlink() or CONFIG.is_symlink() or sha(CONFIG) != args.config_sha256:
        raise SystemExit('Deployment path or config changed; inspect before retry')
    original = CONFIG.read_bytes()
    current = BASE / 'current'
    previous_current = None
    if args.update:
        if not BASE.is_dir() or not current.is_symlink() or not current.resolve().is_dir():
            raise SystemExit('Missing managed homepage current link')
        previous_current = os.readlink(current)
        if not str(current.resolve()).startswith(str((BASE / 'releases').resolve()) + '/'):
            raise SystemExit('Current link points outside managed releases')
        if original.count(MARKER.encode()) != 1 or b'root /var/www/xiangqiao-home/current;' not in original:
            raise SystemExit('Unexpected managed homepage config')
        proposed = original
    else:
        if BASE.exists() or current.is_symlink():
            raise SystemExit('Managed homepage already exists; inspect before updating')
        proposed = homepage_config(original.decode()).encode()
    run('nginx', '-t')
    run('openssl', 'x509', '-in', '/etc/letsencrypt/live/nong.cloud/fullchain.pem', '-noout', '-checkhost', 'nong.cloud', '-checkend', '604800')
    other_sites = {domain: subprocess.check_output(curl_args(domain)) for domain in ('m.nong.cloud', 'api.nong.cloud')}
    legacy_api = subprocess.check_output(curl_args('nong.cloud', '/api/v1/') + ['-o', '/dev/null', '-w', '%{http_code}'])
    if legacy_api != b'401':
        raise SystemExit('Unexpected legacy API baseline')
    protected = protected_fingerprints()
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = BACKUPS / stamp
    backup.mkdir(parents=True, mode=0o700)
    backup.chmod(0o700)
    shutil.copy2(CONFIG, backup / CONFIG.name)
    atomic_write(backup / 'protected-sha256.json', json.dumps(protected, indent=2).encode(), 0o600)
    release = BASE / 'releases' / stamp
    release.mkdir(parents=True, mode=0o755)
    for directory in (BASE, release.parent, release):
        directory.chmod(0o755)
    activated = False
    try:
        extract_dist(args.bundle, release)
        switch_current(current, release, stamp)
        activated = True
        atomic_write(CONFIG, proposed, CONFIG.stat().st_mode & 0o777)
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        wait_for_output(curl_args('nong.cloud') + ['--fail'], (release / 'index.html').read_bytes())
        wait_for_output(curl_args('nong.cloud', '/brand-site/brand/fuan-grapes.jpg') + ['--fail'], (release / 'brand-site/brand/fuan-grapes.jpg').read_bytes())
        for domain, body in other_sites.items():
            wait_for_output(curl_args(domain) + ['--fail'], body)
        wait_for_output(curl_args('nong.cloud', '/api/v1/') + ['-o', '/dev/null', '-w', '%{http_code}'], legacy_api)
        if protected_fingerprints() != protected:
            raise RuntimeError('Protected files changed; inspect backups')
        manifest = dict(domain='nong.cloud', release=str(release), current=str(current), backup=str(backup),
                        config=str(CONFIG), released_at_utc=stamp, bundle_sha256=args.sha256,
                        previous_config_sha256=args.config_sha256, other_sites_unchanged=True,
                        legacy_api_status=401, certificate_reused=True, previous_current=previous_current)
        atomic_write(backup / 'deployment.json', json.dumps(manifest, indent=2).encode(), 0o600)
        atomic_write(BASE / 'deployment.json', json.dumps(manifest, indent=2).encode())
        print(json.dumps(manifest, indent=2))
    except Exception:
        if previous_current:
            switch_current(current, previous_current, stamp + '-rollback')
        elif current.is_symlink():
            current.unlink()
        if activated:
            atomic_write(CONFIG, original, (backup / CONFIG.name).stat().st_mode & 0o777)
            run('nginx', '-t')
            run('systemctl', 'reload', 'nginx')
        print('Homepage rolled back; release and backups retained.')
        raise


if __name__ == '__main__':
    main()
