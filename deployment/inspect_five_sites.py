"""Read-only live snapshot: pass over SSH stdin, never interpolate source in shell."""
import hashlib
import json
import os
import subprocess
import time
from pathlib import Path

if os.geteuid() != 0:
    raise RuntimeError("Root is required for configuration inspection")

domains = ["nong.cloud", "m.nong.cloud", "api.nong.cloud", "nc.nong.cloud", "work.nong.cloud"]
bases = ["/var/www/xiangqiao-home", "/var/www/xiangqiao-api-portal", "/var/www/xiangqiao-cloud-farm", "/var/www/xiangqiao-work"]
configs = {}
for domain in domains:
    p = Path("/etc/nginx/conf.d") / (domain + ".conf")
    configs[domain] = {"sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "text": p.read_text(),
                       "uid": p.lstat().st_uid, "symlink": p.is_symlink()}
protected = {}
for name in ["/var/www/nong.cloud/index.html", "/var/www/xiangqiao-api/join.php"]:
    protected[name] = hashlib.sha256(Path(name).read_bytes()).hexdigest()
auth = Path("/root/.ssh/authorized_keys")
key_lines = [line for line in auth.read_text().splitlines()
             if line.endswith(("xiangqiao-vi-release-20261005-HDGCJg", "xiangqiao-vi-release-20261005-Gykn0U"))]
backup = Path("/root/.ssh/authorized_keys.before-xiangqiao-vi-20261005-Gykn0U")
check = subprocess.run(["nginx", "-t"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
print(json.dumps({"configs": configs, "links": {b: str((Path(b) / "current").resolve()) for b in bases},
                  "protected": protected, "auth_lines": key_lines,
                  "auth_original_sha": hashlib.sha256(backup.read_bytes()).hexdigest() if backup.is_file() else None,
                  "nginx_test": {"code": check.returncode, "output": check.stderr},
                  "server_utc": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())}, ensure_ascii=False))
