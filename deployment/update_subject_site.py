"""Update an existing, inspected nc.nong.cloud or work.nong.cloud demo.

Switch the managed release link; preserve certificates, authentication and API
policies. For the separately approved work-site prototype only, insert a bounded
static location, keeping the remaining vhost exact. Roll back link and that
configuration if readiness checks fail. Installation is not supported.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import deploy_cloud_farm as installer
from deploy_api_site import atomic_write, wait_for_output
from deploy_home_site import switch_current
import miniapp_preview

SITES = {
    'farm': ('nc.nong.cloud', Path('/var/www/xiangqiao-cloud-farm'), Path('/var/backups/xiangqiao-cloud-farm')),
    'work': ('work.nong.cloud', Path('/var/www/xiangqiao-work'), Path('/var/backups/xiangqiao-work')),
}
NGINX = Path('/etc/nginx')
PROTOTYPE_BLOCK = '''    # xiangqiao-miniapp-preview: static local-demo UI only
    location ^~ /miniapp-preview/ {
        try_files $uri $uri/ =404;
        index index.html;
        add_header Cache-Control no-store always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options SAMEORIGIN always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
    }
'''


def prototype_config(original):
    if re.findall(r'\bserver_name\s+([^;]+);', original) != ['work.nong.cloud', 'work.nong.cloud']:
        raise RuntimeError('Prototype route is scoped to work.nong.cloud only')
    if original.count(PROTOTYPE_BLOCK) == 1 and original.count('/miniapp-preview/') == 1:
        return original
    anchor = '    location ^~ /assets/ {'
    if '/miniapp-preview' in original or original.count(anchor) != 1:
        raise RuntimeError('Unexpected prototype route owner')
    result = original.replace(anchor, PROTOTYPE_BLOCK + anchor, 1)
    if result.replace(PROTOTYPE_BLOCK, '', 1) != original:
        raise RuntimeError('Prototype route preservation failed')
    return result


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def protected():
    files = list(NGINX.rglob('*.conf'))
    files.extend([Path('/var/www/nong.cloud/index.html'), Path('/var/www/xiangqiao-api/join.php')])
    return {str(p): sha(p) for p in sorted(files) if p.is_file()}


def validate_owner(base, config, domain, config_sha):
    current = base / 'current'
    if base.is_symlink() or not base.is_dir() or config.is_symlink() or not config.is_file() or sha(config) != config_sha or not current.is_symlink():
        raise RuntimeError('Inspected subject site configuration changed')
    previous = current.resolve()
    if previous.parent != (base / 'releases').resolve() or not previous.is_dir():
        raise RuntimeError('Unexpected subject site release owner')
    text = config.read_text()
    if re.findall(r'\bserver_name\s+([^;]+);', text) != [domain, domain] or text.count('root ' + str(current) + ';') != 1 or 'return 503' not in text or 'location ~ ^/api(/|$)' not in text:
        raise RuntimeError('Unexpected subject site routing policy')
    return previous


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', choices=SITES, required=True)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--config-sha256', required=True)
    parser.add_argument('--prototype-bundle', type=Path)
    parser.add_argument('--prototype-sha256')
    args = parser.parse_args()
    if bool(args.prototype_bundle) != bool(args.prototype_sha256) or (args.prototype_bundle and args.site != 'work'):
        raise SystemExit('Prototype bundle/checksum must be paired and scoped to work only')
    if args.prototype_bundle and (not re.fullmatch('[0-9a-f]{64}', args.prototype_sha256) or sha(args.prototype_bundle) != args.prototype_sha256):
        raise SystemExit('Prototype checksum validation failed')
    if os.geteuid() != 0 or not re.fullmatch('[0-9a-f]{64}', args.sha256) or sha(args.bundle) != args.sha256:
        raise SystemExit('Root/checksum validation failed')
    domain, base, backups = SITES[args.site]
    config = NGINX / 'conf.d' / (domain + '.conf')
    previous = validate_owner(base, config, domain, args.config_sha256)
    original_config = config.read_bytes()
    proposed_config = prototype_config(original_config.decode()).encode() if args.prototype_bundle else original_config
    if not args.prototype_bundle and b'/miniapp-preview/' in original_config:
        raise SystemExit('Existing prototype must be explicitly included in future work updates')
    current = base / 'current'
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['openssl', 'x509', '-in', '/etc/letsencrypt/live/' + domain + '/fullchain.pem', '-noout', '-checkhost', domain, '-checkend', '604800'], check=True)
    fingerprints = protected()
    others = [d for d in ('nong.cloud', 'm.nong.cloud', 'api.nong.cloud', 'nc.nong.cloud', 'work.nong.cloud') if d != domain and (NGINX / 'conf.d' / (d + '.conf')).is_file()]
    other_sites = {d: subprocess.check_output(installer.curl(d)) for d in others}
    api_status = subprocess.check_output(installer.curl(domain, '/api/v1/plots') + ['-o', '/dev/null', '-w', '%{http_code}'])
    legacy_status = subprocess.check_output(installer.curl('nong.cloud', '/api/v1/') + ['-o', '/dev/null', '-w', '%{http_code}'])
    if api_status != b'503' or legacy_status != b'401':
        raise SystemExit('Unexpected business API baseline')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = backups / stamp
    backup.mkdir(parents=True, mode=0o700)
    backup.chmod(0o700)
    atomic_write(backup / config.name, config.read_bytes(), 0o600)
    atomic_write(backup / 'protected-sha256.json', json.dumps(fingerprints, indent=2).encode(), 0o600)
    release = base / 'releases' / stamp
    release.mkdir(mode=0o755)
    changed = False
    config_changed = False
    try:
        installer.DOMAIN = domain
        installer.extract_dist(args.bundle, release)
        if args.prototype_bundle:
            miniapp_preview.extract(args.prototype_bundle, release / 'miniapp-preview')
        if validate_owner(base, config, domain, args.config_sha256) != previous or protected() != fingerprints:
            raise RuntimeError('Site changed during preparation')
        switch_current(current, release, stamp)
        changed = True
        if proposed_config != original_config:
            atomic_write(config, proposed_config, config.stat().st_mode & 0o777)
            config_changed = True
            subprocess.run(['nginx', '-t'], check=True)
            subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        routes = ['/', '/farms', '/my-farm'] if args.site == 'farm' else ['/', '/login', '/workspace/farmer', '/workspace/service']
        for route in routes:
            wait_for_output(installer.curl(domain, route) + ['--fail'], (release / 'index.html').read_bytes())
        for asset in (release / 'assets').iterdir():
            if asset.is_file() and asset.suffix in ('.js', '.css'):
                wait_for_output(installer.curl(domain, '/assets/' + asset.name) + ['--fail'], asset.read_bytes())
        for name in ('favicon.svg', 'fuan-vineyard.jpg'):
            wait_for_output(installer.curl(domain, '/brand/' + name) + ['--fail'], (release / 'brand' / name).read_bytes())
        if args.prototype_bundle:
            miniapp_preview.verify(release / 'miniapp-preview', installer.curl, wait_for_output)
        wait_for_output(installer.curl(domain, '/api/v1/plots') + ['-o', '/dev/null', '-w', '%{http_code}'], api_status)
        wait_for_output(installer.curl('nong.cloud', '/api/v1/') + ['-o', '/dev/null', '-w', '%{http_code}'], legacy_status)
        for d, body in other_sites.items():
            wait_for_output(installer.curl(d) + ['--fail'], body)
        expected = dict(fingerprints)
        if config_changed:
            expected[str(config)] = sha(config)
            if config.read_bytes() != proposed_config:
                raise RuntimeError('Prototype configuration changed unexpectedly')
        if protected() != expected:
            raise RuntimeError('Protected configurations/files changed')
        manifest = dict(domain=domain, released_at_utc=stamp, release=str(release), previous_release=str(previous), backup=str(backup), bundle_sha256=args.sha256, config_unchanged=not config_changed, config_sha256=sha(config), previous_config_sha256=args.config_sha256, other_sites_unchanged=True, mode='demo', real_transactions_enabled=False, prototype_path=miniapp_preview.PREFIX if args.prototype_bundle else None, prototype_sha256=args.prototype_sha256)
        atomic_write(backup / 'deployment.json', json.dumps(manifest, indent=2).encode(), 0o600)
        atomic_write(base / 'deployment.json', json.dumps(manifest, indent=2).encode())
        print(json.dumps(manifest, indent=2), flush=True)
    except BaseException:
        if changed:
            switch_current(current, previous, stamp + '-rollback')
        if config_changed:
            atomic_write(config, original_config, config.stat().st_mode & 0o777)
            subprocess.run(['nginx', '-t'], check=True)
            subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        print('Subject site update rolled back; release/backups retained.', flush=True)
        raise


if __name__ == '__main__':
    main()
