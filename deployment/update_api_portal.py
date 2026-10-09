"""Update only the existing API documentation/sandbox frontend release.

No gateway or backend changes. Validate the inspected vhost hash and current
link ownership; preserve its JSON-503 API policy and all other site configs.
"""
import argparse
import hashlib
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from deploy_api_site import atomic_write, extract_dist, wait_for_output
from deploy_home_site import switch_current

BASE = Path('/var/www/xiangqiao-api-portal')
CONFIG = Path('/etc/nginx/conf.d/api.nong.cloud.conf')
BACKUPS = Path('/var/backups/xiangqiao-api-portal')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def curl(domain, route='/'):
    return ['curl', '--silent', '--show-error', '--max-time', '10', '--noproxy', '*',
            '--resolve', domain + ':443:127.0.0.1', 'https://' + domain + route]


def protected():
    files = list(Path('/etc/nginx').rglob('*.conf'))
    files += [Path('/var/www/nong.cloud/index.html'), Path('/var/www/xiangqiao-api/join.php')]
    return {str(p): sha(p) for p in sorted(files) if p.is_file()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--config-sha256', required=True)
    args = parser.parse_args()
    if os.geteuid() != 0 or sha(args.bundle) != args.sha256:
        raise SystemExit('Root/checksum validation failed')
    current = BASE / 'current'
    if BASE.is_symlink() or not BASE.is_dir() or CONFIG.is_symlink() or sha(CONFIG) != args.config_sha256 or not current.is_symlink():
        raise SystemExit('Inspected API configuration changed')
    previous = current.resolve()
    if previous.parent != (BASE / 'releases').resolve() or not previous.is_dir():
        raise SystemExit('Unexpected API release owner')
    if str(current) not in CONFIG.read_text() or 'return 503' not in CONFIG.read_text():
        raise SystemExit('Unexpected API vhost routing policy')
    fingerprints = protected()
    other_domains = [d for d in ('nong.cloud', 'm.nong.cloud', 'nc.nong.cloud', 'work.nong.cloud') if Path('/etc/nginx/conf.d/' + d + '.conf').is_file()]
    other_sites = {d: subprocess.check_output(curl(d)) for d in other_domains}
    api_status = subprocess.check_output(curl('api.nong.cloud', '/open-api/v1/plots') + ['-o', '/dev/null', '-w', '%{http_code}'])
    if api_status != b'503':
        raise SystemExit('Unexpected API baseline')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = BACKUPS / stamp
    backup.mkdir(parents=True, mode=0o700)
    backup.chmod(0o700)
    atomic_write(backup / CONFIG.name, CONFIG.read_bytes(), 0o600)
    atomic_write(backup / 'protected-sha256.json', json.dumps(fingerprints, indent=2).encode(), 0o600)
    release = BASE / 'releases' / stamp
    release.mkdir(mode=0o755)
    changed = False
    try:
        extract_dist(args.bundle, release)
        changed = True
        switch_current(current, release, stamp)
        wait_for_output(curl('api.nong.cloud') + ['--fail'], (release / 'index.html').read_bytes())
        for asset in (release / 'assets').iterdir():
            if asset.suffix in ('.js', '.css'):
                wait_for_output(curl('api.nong.cloud', '/assets/' + asset.name) + ['--fail'], asset.read_bytes())
        wait_for_output(curl('api.nong.cloud', '/open-api/v1/plots') + ['-o', '/dev/null', '-w', '%{http_code}'], api_status)
        for domain, body in other_sites.items():
            wait_for_output(curl(domain) + ['--fail'], body)
        if protected() != fingerprints:
            raise RuntimeError('Protected configurations changed')
        manifest = dict(domain='api.nong.cloud', released_at_utc=stamp, release=str(release),
                        previous_release=str(previous), backup=str(backup), bundle_sha256=args.sha256,
                        config_unchanged=True, real_gateway_enabled=False, other_sites_unchanged=True)
        atomic_write(backup / 'deployment.json', json.dumps(manifest, indent=2).encode(), 0o600)
        print(json.dumps(manifest, indent=2), flush=True)
    except BaseException:
        if changed:
            switch_current(current, previous, stamp + '-rollback')
        print('API documentation update rolled back; release/backups retained.', flush=True)
        raise


if __name__ == '__main__':
    main()
