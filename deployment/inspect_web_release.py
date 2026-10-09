"""Read-only baseline for the five existing Xiangqiao demo sites."""
import hashlib
import json
import os
import subprocess
from pathlib import Path

if os.geteuid() != 0:
    raise RuntimeError('Root required for read-only inspection')
sites = {'nong.cloud': '/var/www/xiangqiao-home', 'api.nong.cloud': '/var/www/xiangqiao-api-portal',
         'nc.nong.cloud': '/var/www/xiangqiao-cloud-farm', 'work.nong.cloud': '/var/www/xiangqiao-work'}
configs = {}
for domain in ['nong.cloud', 'm.nong.cloud', 'nc.nong.cloud', 'api.nong.cloud', 'work.nong.cloud']:
    path = Path('/etc/nginx/conf.d') / (domain + '.conf')
    configs[domain] = {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'text': path.read_text(), 'symlink': path.is_symlink()}
check = subprocess.run(['nginx', '-t'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
protected = {}
for name in ['/var/www/nong.cloud/index.html', '/var/www/xiangqiao-api/join.php']:
    protected[name] = hashlib.sha256(Path(name).read_bytes()).hexdigest()
backup = Path('/root/.ssh/authorized_keys.before-xiangqiao-web-v41-20261006-EXIlzn')
auth = Path('/root/.ssh/authorized_keys')
print(json.dumps({'configs': configs, 'links': {d: str((Path(b) / 'current').resolve()) for d, b in sites.items()},
                  'protected': protected, 'nginx_test': {'code': check.returncode, 'output': check.stderr},
                  'auth_backup_sha256': hashlib.sha256(backup.read_bytes()).hexdigest() if backup.is_file() else None,
                  'auth_current_sha256': hashlib.sha256(auth.read_bytes()).hexdigest()}, ensure_ascii=False))
