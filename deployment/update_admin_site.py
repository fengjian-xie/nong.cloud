"""Scoped update of the inspected m.nong.cloud managed frontend demonstration.

Replace only managed UI release references and the explicit UI route whitelist.
Preserve the original catch-all backend proxy and certificate byte-for-byte.
Fail closed on config/checksum/layout changes; retain the old release and backup.
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

CONFIG = Path('/etc/nginx/conf.d/m.nong.cloud.conf')
BASE = Path('/var/www/fuan-releases')
BACKUPS = Path('/var/backups/fuan-deploy')
OLD_ROUTES = 'login|members|tasks|plots|services|supply|config|settings|audit'
PREVIOUS_ROUTES = OLD_ROUTES + '|cards|records|production|soil|costs|maturity|resources|inventory|procurement|merchants|verification|trace|cloud-farms|workspaces|workspace|open-api'
ROUTES = PREVIOUS_ROUTES + '|manage'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args):
    subprocess.run(args, check=True)


def updated_config(original, release):
    names = re.findall(r'\bserver_name\s+([^;]+);', original)
    refs = re.findall(r'/var/www/fuan-releases/[a-zA-Z0-9-]+', original)
    old_location = '    location ~ ^/(' + OLD_ROUTES + ')(/|$) {'
    previous_location = '    location ~ ^/(' + PREVIOUS_ROUTES + ')(/|$) {'
    new_location = '    location ~ ^/(' + ROUTES + ')(/|$) {'
    if names != ['m.nong.cloud', 'm.nong.cloud'] or original.count('# FUAN FRONTEND MANAGED RELEASE') != 1:
        raise RuntimeError('Unexpected managed admin config')
    first_update = len(refs) == 3 and original.count(old_location) == 1 and new_location not in original and '/fuan-ui/brand/' not in original
    known_location = original.count(previous_location) + original.count(new_location) == 1
    repeat_update = len(refs) == 4 and known_location and old_location not in original and original.count('    location ^~ /fuan-ui/brand/ {') == 1
    if len(set(refs)) != 1 or not (first_update or repeat_update):
        raise RuntimeError('Unexpected managed admin release/routes')
    if not re.search(r'location / \{\s*proxy_pass http://127\.0\.0\.1:8080;', original):
        raise RuntimeError('Unexpected backend catch-all')
    previous = refs[0]
    result = original.replace(previous, str(release))
    result = result.replace(old_location, new_location)
    result = result.replace(previous_location, new_location)
    additions = '''    location ^~ /fuan-ui/brand/ {
        alias RELEASE/brand/;
        add_header X-Content-Type-Options nosniff always;
    }
'''.replace('RELEASE', str(release))
    if first_update:
        result = result.replace(new_location, additions + new_location, 1)
    # Everything from the old backend proxy to the HTTP/TLS settings stays exact.
    if result[result.index('    location / {'):] != original[original.index('    location / {'):]:
        raise RuntimeError('Backend/certificate preservation failed')
    return result, previous


def extract_dist(bundle, release):
    with tarfile.open(bundle, 'r:gz') as archive:
        seen = set()
        for member in archive.getmembers():
            parts = PurePosixPath(member.name).parts
            if not parts or parts[0] != 'dist' or '..' in parts or not (member.isdir() or member.isfile()):
                raise RuntimeError('Unsafe admin archive member')
            relative = parts[1:]
            if not relative:
                continue
            if relative[0] not in ('index.html', 'assets', 'brand') or relative in seen:
                raise RuntimeError('Unexpected or duplicate admin file')
            if relative[0] == 'index.html' and (len(relative) != 1 or not member.isfile()):
                raise RuntimeError('Invalid admin index')
            seen.add(relative)
            target = release.joinpath(*relative)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True, mode=0o755)
            else:
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                with archive.extractfile(member) as source:
                    target.write_bytes(source.read())
                target.chmod(0o644)
    index = release / 'index.html'
    if not index.is_file() or '福安管理后台' not in index.read_text(encoding='utf-8'):
        raise RuntimeError('Not an admin-site build')
    refs = re.findall(r'(?:src|href)="(/fuan-ui/assets/[^"?]+)"', index.read_text(encoding='utf-8'))
    if not refs or any(not release.joinpath(ref[len('/fuan-ui/'):]).is_file() for ref in refs):
        raise RuntimeError('Missing admin entry assets')
    if not (release / 'brand/favicon.svg').is_file():
        raise RuntimeError('Missing admin icon')
    for directory in release.rglob('*'):
        if directory.is_dir():
            directory.chmod(0o755)


def curl(domain, path='/'):
    return ['curl', '--silent', '--show-error', '--max-time', '10', '--noproxy', '*',
            '--resolve', domain + ':443:127.0.0.1', 'https://' + domain + path]


def fingerprints():
    files = [p for p in Path('/etc/nginx').rglob('*.conf') if p.is_file() and p != CONFIG]
    files.extend([Path('/var/www/nong.cloud/index.html'), Path('/var/www/xiangqiao-api/join.php')])
    return {str(p): sha(p) for p in sorted(files) if p.is_file()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--config-sha256', required=True)
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Root required')
    if not re.fullmatch('[0-9a-f]{64}', args.sha256) or sha(args.bundle) != args.sha256:
        raise SystemExit('Bundle checksum mismatch')
    if BASE.is_symlink() or not BASE.is_dir() or CONFIG.is_symlink() or sha(CONFIG) != args.config_sha256:
        raise SystemExit('Admin deployment/config changed; inspect before retry')
    original = CONFIG.read_bytes()
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    release = BASE / stamp
    proposed, previous = updated_config(original.decode(), release)
    if not Path(previous).is_dir():
        raise SystemExit('Previous admin release missing')
    run('nginx', '-t')
    run('openssl', 'x509', '-in', '/etc/letsencrypt/live/m.nong.cloud/fullchain.pem', '-noout', '-checkhost', 'm.nong.cloud', '-checkend', '604800')
    protected = fingerprints()
    domains = ['nong.cloud', 'api.nong.cloud']
    if Path('/etc/nginx/conf.d/nc.nong.cloud.conf').is_file():
        domains.append('nc.nong.cloud')
    if Path('/etc/nginx/conf.d/work.nong.cloud.conf').is_file():
        domains.append('work.nong.cloud')
    other_sites = {domain: subprocess.check_output(curl(domain)) for domain in domains}
    api_status = subprocess.check_output(curl('m.nong.cloud', '/api/v1/') + ['-o', '/dev/null', '-w', '%{http_code}'])
    backup = BACKUPS / stamp
    backup.mkdir(parents=True, mode=0o700)
    backup.chmod(0o700)
    shutil.copy2(CONFIG, backup / CONFIG.name)
    atomic_write(backup / 'protected-sha256.json', json.dumps(protected, indent=2).encode(), 0o600)
    release.mkdir(mode=0o755)
    release.chmod(0o755)
    changed = False
    try:
        extract_dist(args.bundle, release)
        if CONFIG.read_bytes() != original:
            raise RuntimeError('Admin config changed during preparation')
        changed = True
        atomic_write(CONFIG, proposed.encode(), CONFIG.stat().st_mode & 0o777)
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        expected = (release / 'index.html').read_bytes()
        for route in ['/', '/login', '/cards', '/records', '/inventory', '/workspaces', '/workspace/farmer', '/open-api', '/manage', '/manage/subjects/members', '/manage/production/plots', '/manage/services/orders', '/manage/trade/supply', '/manage/quality/verification', '/manage/customer/support', '/manage/finance/settlement', '/manage/platform/integrations']:
            wait_for_output(curl('m.nong.cloud', route) + ['--fail'], expected)
        for asset in (release / 'assets').iterdir():
            command = curl('m.nong.cloud', '/fuan-ui/assets/' + asset.name) + ['--fail']
            expected_asset = asset.read_bytes()
            if asset.suffix == '.mp4':
                command += ['--range', '0-1023']; expected_asset = expected_asset[:1024]
            wait_for_output(command, expected_asset)
        wait_for_output(curl('m.nong.cloud', '/fuan-ui/brand/favicon.svg') + ['--fail'], (release / 'brand/favicon.svg').read_bytes())
        wait_for_output(curl('m.nong.cloud', '/api/v1/') + ['-o', '/dev/null', '-w', '%{http_code}'], api_status)
        for domain, body in other_sites.items():
            wait_for_output(curl(domain) + ['--fail'], body)
        if fingerprints() != protected:
            raise RuntimeError('Other site configuration/files changed')
        manifest = dict(domain='m.nong.cloud', mode='frontend-demo', released_at_utc=stamp,
                        release=str(release), previous_release=previous, backup=str(backup),
                        bundle_sha256=args.sha256, config_sha256=sha(CONFIG),
                        backend_proxy_preserved=True, other_sites_unchanged=True)
        atomic_write(backup / 'deployment.json', json.dumps(manifest, indent=2).encode(), 0o600)
        print(json.dumps(manifest, indent=2), flush=True)
    except BaseException:
        if changed:
            atomic_write(CONFIG, original, (backup / CONFIG.name).stat().st_mode & 0o777)
            run('nginx', '-t')
            run('systemctl', 'reload', 'nginx')
        print('Admin update rolled back; release/backup retained.', flush=True)
        raise


if __name__ == '__main__':
    main()
