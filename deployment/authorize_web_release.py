"""Append/revoke one explicitly approved, restricted, <=2-hour root key.

No SSH settings, ports or other authorization lines are changed. Never restore
an entire old authorized_keys file. The private key is never sent to this script.
"""
import argparse
import base64
import fcntl
import hashlib
import os
import re
import stat
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path


def checked_key(encoded, label):
    if not re.fullmatch(r'xiangqiao-web-v41-\d{8}-[A-Za-z0-9]+', label):
        raise RuntimeError('Unexpected task label')
    key = base64.b64decode(encoded, validate=True).strip()
    if not re.fullmatch(rb'ssh-ed25519 [A-Za-z0-9+/=]+ ' + label.encode(), key):
        raise RuntimeError('Unexpected public key')
    return key


def change(path, backup, key, expires, revoke=False, expected_uid=0):
    path, backup = Path(path), Path(backup)
    s, d = path.lstat(), path.parent.lstat()
    if not (stat.S_ISREG(s.st_mode) and s.st_uid == expected_uid and s.st_mode & 0o022 == 0
            and stat.S_ISDIR(d.st_mode) and d.st_uid == expected_uid and d.st_mode & 0o022 == 0):
        raise RuntimeError('授权文件/目录类型、归属或权限异常，停止操作')
    expiry = time.strftime('%Y%m%d%H%M%S', time.localtime(expires))
    parsed = time.strptime(expiry, '%Y%m%d%H%M%S')
    if time.mktime(tuple(parsed[:8]) + (0,)) != expires:
        raise RuntimeError('服务器本地到期时间换算失败')
    line = ('restrict,expiry-time="' + expiry + '" ').encode() + key
    fd = os.open(str(path), os.O_RDWR | os.O_NOFOLLOW)
    with os.fdopen(fd, 'r+b', buffering=0) as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        opened = os.fstat(handle.fileno())
        if (opened.st_dev, opened.st_ino) != (s.st_dev, s.st_ino):
            raise RuntimeError('授权文件已变更，停止操作')
        before = handle.read()
        lines = before.splitlines(keepends=True)
        matches = [item for item in lines if item.rstrip(b'\r\n').endswith(key)]
        if matches and (len(matches) != 1 or matches[0].rstrip(b'\r\n') != line):
            raise RuntimeError('本次公钥的现有授权选项异常，停止操作')
        if revoke:
            after = b''.join(item for item in lines if item not in matches)
            original_backup = backup.with_name(backup.name.replace('.before-revoke-', '.before-'))
            if original_backup.is_file():
                original = original_backup.read_bytes()
                if original and not original.endswith(b'\n') and after == original + b'\n':
                    after = original
        else:
            remaining = expires - time.time()
            if not 0 < remaining <= 7200:
                raise RuntimeError('授权已过期或超过2小时，停止操作')
            after = before if matches else before + (b'\n' if before and not before.endswith(b'\n') else b'') + line + b'\n'
        if after != before:
            saved_fd = os.open(str(backup), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(saved_fd, 'wb') as saved:
                saved.write(before); saved.flush(); os.fsync(saved.fileno())
            if backup.read_bytes() != before or path.read_bytes() != before:
                raise RuntimeError('备份或授权文件已变化，停止操作')
            if not revoke and time.time() >= expires:
                raise RuntimeError('授权已过期，停止操作')
            handle.seek(0); written = handle.write(after); handle.truncate(); os.fsync(handle.fileno()); handle.seek(0)
            if written != len(after) or handle.read() != after:
                raise RuntimeError('授权变更核验失败，保留备份并停止操作')
        final = os.fstat(handle.fileno())
        if (final.st_uid, final.st_gid, stat.S_IMODE(final.st_mode), final.st_ino) != (s.st_uid, s.st_gid, stat.S_IMODE(s.st_mode), s.st_ino):
            raise RuntimeError('授权文件属性变化')
    return {'status': 'XIANGQIAO_WEB_AUTH_REVOKED' if revoke else 'XIANGQIAO_WEB_AUTH_READY',
            'changed': after != before, 'expiry_local': expiry,
            'expiry_beijing': datetime.fromtimestamp(expires, timezone(timedelta(hours=8))).isoformat(),
            'before_sha256': hashlib.sha256(before).hexdigest(), 'after_sha256': hashlib.sha256(after).hexdigest(),
            'backup': str(backup)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--key-base64', required=True)
    parser.add_argument('--label', required=True)
    parser.add_argument('--expires-at', required=True, type=int)
    parser.add_argument('--revoke', action='store_true')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise RuntimeError('请在已登录root终端执行')
    os.environ.pop('TZ', None); time.tzset()
    key = checked_key(args.key_base64, args.label)
    name = 'authorized_keys.before-' + ('revoke-' if args.revoke else '') + args.label
    result = change(Path('/root/.ssh/authorized_keys'), Path('/root/.ssh') / name, key, args.expires_at, args.revoke)
    print(result.pop('status'))
    for name, value in result.items():
        print(str(name) + '=' + str(value))


if __name__ == '__main__':
    main()
