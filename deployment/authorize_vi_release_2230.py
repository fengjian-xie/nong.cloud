"""Install this newly approved key; OpenSSH 8.0-compatible expiry at 22:30 CST."""
import fcntl
import hashlib
import os
import stat
import time
from datetime import datetime, timezone
from pathlib import Path

DEADLINE = datetime(2026, 10, 5, 14, 30, tzinfo=timezone.utc).timestamp()
KEY = b"ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGwotVjEehxW7guisbRYNf6keJTzkI1w5Q1+X5/7NIZa xiangqiao-vi-release-20261005-Gykn0U"
AUTH_PATH = Path("/root/.ssh/authorized_keys")
BACKUP_PATH = Path("/root/.ssh/authorized_keys.before-xiangqiao-vi-20261005-Gykn0U")


def authorize(path=AUTH_PATH, backup=BACKUP_PATH, expected_uid=0):
    if time.time() >= DEADLINE:
        raise RuntimeError("本次22:30授权已过期，停止操作")
    path, backup = Path(path), Path(backup)
    s, d = path.lstat(), path.parent.lstat()
    if not (stat.S_ISREG(s.st_mode) and s.st_uid == expected_uid and s.st_mode & 0o022 == 0
            and stat.S_ISDIR(d.st_mode) and d.st_uid == expected_uid and d.st_mode & 0o022 == 0):
        raise RuntimeError("授权文件或目录的类型、归属、权限异常，停止操作")
    expiry = time.strftime("%Y%m%d%H%M%S", time.localtime(DEADLINE))
    parsed = time.strptime(expiry, "%Y%m%d%H%M%S")
    if time.mktime(tuple(parsed[:8]) + (0,)) != DEADLINE:
        raise RuntimeError("不能安全换算原截止时间，停止操作")
    key_line = ('restrict,expiry-time="' + expiry + '" ').encode() + KEY
    fd = os.open(str(path), os.O_RDWR | os.O_NOFOLLOW)
    with os.fdopen(fd, "r+b", buffering=0) as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        opened = os.fstat(handle.fileno())
        if (opened.st_dev, opened.st_ino) != (s.st_dev, s.st_ino):
            raise RuntimeError("授权文件发生变化，停止操作")
        before = handle.read()
        existing = [line for line in before.splitlines() if KEY in line]
        if existing:
            if existing != [key_line]:
                raise RuntimeError("本次公钥已有非预期的授权选项，停止操作")
            return {"status": "XIANGQIAO_VI_AUTH_READY", "already_authorized": True,
                    "expiry_local": expiry, "expiry_beijing": "2026-10-05 22:30"}
        saved_fd = os.open(str(backup), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(saved_fd, "wb") as saved:
            saved.write(before)
            saved.flush()
            os.fsync(saved.fileno())
        if backup.read_bytes() != before or path.read_bytes() != before:
            raise RuntimeError("备份不一致或授权文件变化，停止操作")
        if time.time() >= DEADLINE:
            raise RuntimeError("本次授权已过期，停止操作")
        addition = (b"\n" if before and not before.endswith(b"\n") else b"") + key_line + b"\n"
        handle.seek(0, os.SEEK_END)
        written = handle.write(addition)
        os.fsync(handle.fileno())
        handle.seek(0)
        if written != len(addition) or handle.read() != before + addition:
            raise RuntimeError("追加核验失败，保留备份并停止操作")
    return {"status": "XIANGQIAO_VI_AUTH_READY", "expiry_local": expiry,
            "expiry_beijing": "2026-10-05 22:30", "before_sha256": hashlib.sha256(before).hexdigest(),
            "backup": str(backup)}


if __name__ == "__main__":
    if os.geteuid() != 0:
        raise RuntimeError("请在已登录的root终端执行")
    os.environ.pop("TZ", None)
    time.tzset()
    result = authorize()
    print(result.pop("status"))
    for name, value in result.items():
        print(str(name) + "=" + str(value))
