"""First deployment of the authorized nc.nong.cloud consumer demonstration.

Dedicated vhost/release/certificate; no real camera, contract, payment or API.
Reuse the existing Certbot account without accepting new terms. Refuse any
existing domain owner. Retain releases/backups on failure; roll back this vhost
only. Never alter the original homepage, admin, API gateway or PHP files.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import tarfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

from deploy_api_site import atomic_write, wait_for_output

DOMAIN = 'nc.nong.cloud'
BASE = Path('/var/www/xiangqiao-cloud-farm')
CONFIG = Path('/etc/nginx/conf.d/nc.nong.cloud.conf')
BACKUPS = Path('/var/backups/xiangqiao-cloud-farm')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args):
    subprocess.run(args, check=True)


def protected_fingerprints():
    paths = [p for p in Path('/etc/nginx').rglob('*.conf') if p.is_file() and p != CONFIG]
    paths.extend([Path('/var/www/nong.cloud/index.html'), Path('/var/www/xiangqiao-api/join.php')])
    return {str(p): sha(p) for p in sorted(paths) if p.is_file()}


def vhost(tls=False):
    http = '''server {
    listen 80;
    listen [::]:80;
    server_name nc.nong.cloud;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/xiangqiao-cloud-farm/acme;
        try_files $uri =404;
    }
    location / { return 301 https://nc.nong.cloud$request_uri; }
}
'''
    if not tls:
        return http.replace('nc.nong.cloud', DOMAIN).replace('/var/www/xiangqiao-cloud-farm', str(BASE)).encode()
    headers = '''        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options SAMEORIGIN always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
'''
    https = '''server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name nc.nong.cloud;
    ssl_certificate /etc/letsencrypt/live/nc.nong.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nc.nong.cloud/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    root /var/www/xiangqiao-cloud-farm/current;
    index index.html;
    location ~ ^/api(/|$) {
        default_type application/json;
        add_header Cache-Control no-store always;
        return 503 '{"mode":"demo","message":"农场站仅为交互演示，真实业务接口未接入"}';
    }
    location ^~ /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
HEADERS    }
    location ^~ /brand/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=604800";
HEADERS    }
    location / {
        try_files $uri /index.html;
        add_header Cache-Control no-store always;
HEADERS    }
}
'''.replace('HEADERS', headers)
    # The same scoped installer also powers the dedicated subject demo site.
    return (http + https).replace('nc.nong.cloud', DOMAIN).replace('/var/www/xiangqiao-cloud-farm', str(BASE)).replace('农场站仅为交互演示', '本站仅为交互演示').encode()


def extract_dist(bundle, release):
    with tarfile.open(bundle, 'r:gz') as archive:
        seen = set()
        for member in archive.getmembers():
            parts = PurePosixPath(member.name).parts
            if not parts or parts[0] != 'dist' or '..' in parts or not (member.isdir() or member.isfile()):
                raise RuntimeError('Unsafe archive member')
            relative = parts[1:]
            if not relative:
                continue
            if relative[0] not in ('index.html', 'assets', 'brand') or relative in seen:
                raise RuntimeError('Unexpected or duplicate farm asset')
            if relative[0] == 'index.html' and (len(relative) != 1 or not member.isfile()):
                raise RuntimeError('Invalid index member')
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
    if not index.is_file() or DOMAIN not in index.read_text(encoding='utf-8'):
        raise RuntimeError('Not a farm-site build')
    refs = re.findall(r'(?:src|href)="(/assets/[^"?]+)"', index.read_text(encoding='utf-8'))
    if not refs or any(not release.joinpath(ref.lstrip('/')).is_file() for ref in refs):
        raise RuntimeError('Missing farm entry assets')
    for name in ('fuan-grapes.jpg', 'fuan-vineyard.jpg', 'favicon.svg'):
        if not (release / 'brand' / name).is_file():
            raise RuntimeError('Missing authorized farm media')
    for directory in release.rglob('*'):
        if directory.is_dir():
            directory.chmod(0o755)


def curl(domain, path='/'):
    return ['curl', '--silent', '--show-error', '--max-time', '10', '--noproxy', '*',
            '--resolve', domain + ':443:127.0.0.1', 'https://' + domain + path]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Root required')
    if not re.fullmatch('[0-9a-f]{64}', args.sha256) or sha(args.bundle) != args.sha256:
        raise SystemExit('Bundle checksum mismatch')
    if BASE.exists() or BASE.is_symlink() or CONFIG.exists() or CONFIG.is_symlink():
        raise SystemExit('Farm site already managed; inspect before any update')
    if socket.gethostbyname(DOMAIN) != '8.141.88.22':
        raise SystemExit('Unexpected farm DNS target')
    run('nginx', '-t')
    loaded = subprocess.check_output(['nginx', '-T'], stderr=subprocess.DEVNULL).decode()
    if re.search(r'\bserver_name\s+[^;]*\b' + re.escape(DOMAIN) + r'\b', loaded):
        raise SystemExit('Farm domain belongs to another vhost')
    protected = protected_fingerprints()
    other_domains = [domain for domain in ('nong.cloud', 'm.nong.cloud', 'api.nong.cloud', 'nc.nong.cloud', 'work.nong.cloud') if domain != DOMAIN and Path('/etc/nginx/conf.d/' + domain + '.conf').is_file()]
    other_sites = {domain: subprocess.check_output(curl(domain)) for domain in other_domains}
    legacy_api = subprocess.check_output(curl('nong.cloud', '/api/v1/') + ['-o', '/dev/null', '-w', '%{http_code}'])
    if legacy_api != b'401':
        raise SystemExit('Unexpected legacy API baseline')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = BACKUPS / stamp
    backup.mkdir(parents=True, mode=0o700)
    backup.chmod(0o700)
    for filename in protected:
        source = Path(filename)
        if str(source).startswith('/etc/nginx/'):
            target = backup / 'nginx-before' / source.relative_to('/etc/nginx')
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            shutil.copy2(source, target)
    atomic_write(backup / 'protected-sha256.json', json.dumps(protected, indent=2).encode(), 0o600)
    release = BASE / 'releases' / stamp
    release.mkdir(parents=True, mode=0o755)
    for directory in (BASE, release.parent, release):
        directory.chmod(0o755)
    acme = BASE / 'acme'
    probe = acme / '.well-known/acme-challenge/xiangqiao-farm-check'
    probe.parent.mkdir(parents=True, mode=0o755)
    for directory in (acme, acme / '.well-known', probe.parent):
        directory.chmod(0o755)
    current = BASE / 'current'
    changed = False
    try:
        extract_dist(args.bundle, release)
        current.symlink_to(release)
        atomic_write(probe, b'xiangqiao-farm-http01-ready\n')
        changed = True
        atomic_write(CONFIG, vhost())
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        wait_for_output(['curl', '--fail', '--silent', '--max-time', '2', '--noproxy', '*',
                         '--header', 'Host: ' + DOMAIN,
                         'http://127.0.0.1/.well-known/acme-challenge/xiangqiao-farm-check'], probe.read_bytes())
        run('certbot', 'certonly', '--webroot', '--webroot-path', str(acme), '--cert-name', DOMAIN,
            '--domain', DOMAIN, '--non-interactive', '--keep-until-expiring',
            '--deploy-hook', '/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx')
        run('openssl', 'x509', '-in', '/etc/letsencrypt/live/' + DOMAIN + '/fullchain.pem',
            '-noout', '-checkhost', DOMAIN, '-checkend', '604800')
        atomic_write(CONFIG, vhost(tls=True))
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        wait_for_output(curl(DOMAIN) + ['--fail'], (release / 'index.html').read_bytes())
        wait_for_output(curl(DOMAIN, '/brand/fuan-vineyard.jpg') + ['--fail'], (release / 'brand/fuan-vineyard.jpg').read_bytes())
        for domain, body in other_sites.items():
            wait_for_output(curl(domain) + ['--fail'], body)
        wait_for_output(curl('nong.cloud', '/api/v1/') + ['-o', '/dev/null', '-w', '%{http_code}'], legacy_api)
        if protected_fingerprints() != protected:
            raise RuntimeError('Protected configuration/files changed')
        manifest = dict(domain=DOMAIN, released_at_utc=stamp, bundle_sha256=args.sha256,
                        release=str(release), current=str(current), config=str(CONFIG), backup=str(backup),
                        certificate='/etc/letsencrypt/live/' + DOMAIN, mode='demo',
                        other_sites_unchanged=True, real_transactions_enabled=False)
        atomic_write(backup / 'deployment.json', json.dumps(manifest, indent=2).encode(), 0o600)
        atomic_write(BASE / 'deployment.json', json.dumps(manifest, indent=2).encode())
        probe.unlink()
        print(json.dumps(manifest, indent=2), flush=True)
    except BaseException:
        if current.is_symlink() and current.resolve() == release.resolve():
            current.unlink()
        if changed:
            if CONFIG.is_file() and not CONFIG.is_symlink():
                CONFIG.unlink()
            run('nginx', '-t')
            run('systemctl', 'reload', 'nginx')
        print('Farm activation rolled back; release/backups retained.', flush=True)
        raise


if __name__ == '__main__':
    main()
