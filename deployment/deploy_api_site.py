"""Deploy only api.nong.cloud; keep other vhosts and existing PHP APIs intact.

Run the uploaded script with Python 3 as root, after explicit deployment
authorization. Existing Certbot account required; no ToS acceptance or SSH
credential creation is performed here. Failed activation restores the API
vhost and current link, retaining release/backup artifacts for inspection.
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

BASE = Path('/var/www/xiangqiao-api-portal')
CONFIG = Path('/etc/nginx/conf.d/api.nong.cloud.conf')
DOMAIN = 'api.nong.cloud'
BACKUPS = Path('/var/backups/xiangqiao-api-portal')


def run(*args):
    return subprocess.run(args, check=True)


def wait_for_output(args, expected):
    """HUP reload is asynchronous: check readiness, not just reload exit code."""
    last_error = None
    for attempt in range(15):
        try:
            output = subprocess.check_output(args, stderr=subprocess.DEVNULL)
            if output == expected:
                return
            last_error = RuntimeError('Unexpected readiness response')
        except subprocess.CalledProcessError as error:
            last_error = error
        if attempt < 14:
            time.sleep(0.5)
    raise RuntimeError('Nginx readiness verification failed') from last_error


def atomic_write(path, content, mode=0o644):
    fd, temp = tempfile.mkstemp(prefix='.' + path.name + '-', dir=str(path.parent))
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(content)
        os.chmod(temp, mode)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def nginx_fingerprints():
    return {
        str(path): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(Path('/etc/nginx').rglob('*.conf'))
        if path.is_file() and path != CONFIG
    }


def extract_dist(bundle, release):
    with tarfile.open(bundle, 'r:gz') as archive:
        members = [m for m in archive.getmembers() if m.name == 'dist' or m.name.startswith('dist/')]
        if not members:
            raise RuntimeError('Missing dist directory')
        for member in members:
            parts = PurePosixPath(member.name).parts
            if not parts or parts[0] != 'dist' or '..' in parts or not (member.isdir() or member.isfile()):
                raise RuntimeError('Unsafe release archive member')
            target = release.joinpath(*parts[1:])
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True, mode=0o755)
                target.chmod(0o755)
            else:
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                with archive.extractfile(member) as source:
                    target.write_bytes(source.read())
                target.chmod(0o644)
    index = release / 'index.html'
    if not index.is_file() or '乡桥API开放平台' not in index.read_text(encoding='utf-8'):
        raise RuntimeError('Not an API-site build')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', required=True, type=Path)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--http-template', required=True, type=Path)
    parser.add_argument('--tls-template', required=True, type=Path)
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Root session required')
    if not re.fullmatch(r'[0-9a-f]{64}', args.sha256):
        raise SystemExit('Invalid SHA-256')
    if hashlib.sha256(args.bundle.read_bytes()).hexdigest() != args.sha256:
        raise SystemExit('Release checksum mismatch; nothing changed')
    if BASE.is_symlink() or CONFIG.is_symlink():
        raise SystemExit('Unexpected symlinked deployment path')
    # This first-site installer must not take over an existing API deployment.
    if BASE.exists() or CONFIG.exists():
        raise SystemExit('API portal directory/config already exists; inspect before updating')
    run('nginx', '-t')
    loaded = subprocess.check_output(['nginx', '-T'], stderr=subprocess.DEVNULL).decode()
    if re.search(r'\bserver_name\s+[^;]*\bapi\.nong\.cloud\b', loaded):
        raise SystemExit('API domain already managed by another config')
    http = args.http_template.read_bytes()
    tls = args.tls_template.read_bytes()
    for content in (http, tls):
        if b'server_name api.nong.cloud;' not in content or str(BASE).encode() not in content:
            raise SystemExit('Unexpected vhost template')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = BACKUPS / stamp
    backup.mkdir(parents=True, mode=0o700)
    backup.chmod(0o700)
    protected = nginx_fingerprints()
    for filename in protected:
        source = Path(filename)
        target = backup / 'nginx-before' / source.relative_to('/etc/nginx')
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        shutil.copy2(source, target)
    atomic_write(backup / 'protected-sha256.json', json.dumps(protected, indent=2).encode(), 0o600)
    BASE.mkdir(mode=0o755)
    BASE.chmod(0o755)
    release = BASE / 'releases' / stamp
    release.mkdir(parents=True, mode=0o755)
    release.parent.chmod(0o755)
    release.chmod(0o755)
    acme = BASE / 'acme'
    probe = acme / '.well-known/acme-challenge/xiangqiao-deploy-check'
    probe.parent.mkdir(parents=True, mode=0o755)
    for directory in (acme, acme / '.well-known', probe.parent):
        directory.chmod(0o755)
    current = BASE / 'current'
    changed = False
    try:
        extract_dist(args.bundle, release)
        current.symlink_to(release)
        atomic_write(probe, b'xiangqiao-api-http01-ready\n')
        changed = True
        atomic_write(CONFIG, http)
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        wait_for_output([
            'curl', '--fail', '--silent', '--show-error', '--max-time', '2', '--noproxy', '*',
            '--header', 'Host: ' + DOMAIN,
            'http://127.0.0.1/.well-known/acme-challenge/xiangqiao-deploy-check',
        ], probe.read_bytes())
        # Reuse the existing account. If acceptance/authentication is missing,
        # non-interactive issuance must fail instead of accepting new terms.
        run('certbot', 'certonly', '--webroot', '--webroot-path', str(acme),
            '--cert-name', DOMAIN, '--domain', DOMAIN, '--non-interactive',
            '--keep-until-expiring', '--deploy-hook',
            '/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx')
        run('openssl', 'x509', '-in', '/etc/letsencrypt/live/' + DOMAIN + '/fullchain.pem',
            '-noout', '-checkhost', DOMAIN, '-checkend', '604800')
        atomic_write(CONFIG, tls)
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        wait_for_output(['curl', '--fail', '--silent', '--show-error', '--max-time', '2',
                         '--noproxy', '*', '--resolve', DOMAIN + ':443:127.0.0.1',
                         '--output', '/dev/null', 'https://' + DOMAIN + '/'], b'')
        if nginx_fingerprints() != protected:
            raise RuntimeError('Another Nginx config changed; inspect preserved backups')
        manifest = {
            'domain': DOMAIN, 'released_at_utc': stamp, 'bundle_sha256': args.sha256,
            'release': str(release), 'current': str(current), 'backup': str(backup),
            'config': str(CONFIG), 'certificate': '/etc/letsencrypt/live/' + DOMAIN,
            'previous_api_config': None, 'previous_current': None,
            'other_nginx_configs_unchanged': True,
        }
        atomic_write(backup / 'deployment.json', json.dumps(manifest, indent=2).encode(), 0o600)
        atomic_write(BASE / 'deployment.json', json.dumps(manifest, indent=2).encode())
        probe.unlink()
        print('API_PORTAL_DEPLOYED ' + json.dumps(manifest), flush=True)
    except BaseException:
        if changed:
            # This installer started with no API vhost/link; never restore
            # unrelated configs or delete release directories/old PHP files.
            if CONFIG.is_file() and not CONFIG.is_symlink():
                CONFIG.unlink()
            if current.is_symlink() and current.resolve() == release.resolve():
                current.unlink()
            run('nginx', '-t')
            run('systemctl', 'reload', 'nginx')
            print('API activation rolled back; backup retained at ' + str(backup), flush=True)
        raise


if __name__ == '__main__':
    main()
