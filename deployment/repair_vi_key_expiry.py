"""Repair only this release key's expiry syntax; preserve the approved deadline."""

import fcntl
import hashlib
import os
import stat
import time
from datetime import datetime, timezone
from pathlib import Path


DEADLINE = datetime(2026, 10, 5, 13, 0, tzinfo=timezone.utc).timestamp()
KEY = b"ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICCG+SQt8LR630ZAu0GTEwAUu6yTP1+GYfHiehOuIK9M xiangqiao-vi-release-20261005-HDGCJg"
OLD_LINE = b'restrict,expiry-time="20261005130000Z" ' + KEY
AUTH_PATH = Path("/root/.ssh/authorized_keys")
BACKUP_PATH = Path("/root/.ssh/authorized_keys.before-xiangqiao-vi-timefix-20261005-HDGCJg")


def compatible_expiry():
    spec = time.strftime("%Y%m%d%H%M%S", time.localtime(DEADLINE))
    # OpenSSH 8.0 uses mktime with tm_isdst=0. Never silently extend access
    # in a different time zone or a daylight-saving transition.
    parsed = time.strptime(spec, "%Y%m%d%H%M%S")
    old_parser_epoch = time.mktime(tuple(parsed[:8]) + (0,))
    if old_parser_epoch != DEADLINE:
        raise RuntimeError("服务器时区不能安全换算原到期时间，停止操作")
    return spec


def repair(path=AUTH_PATH, backup=BACKUP_PATH, expected_uid=0):
    if time.time() >= DEADLINE:
        raise RuntimeError("原授权已过期，禁止延长或修复；需重新确认授权")
    path, backup = Path(path), Path(backup)
    file_stat, dir_stat = path.lstat(), path.parent.lstat()
    if not (stat.S_ISREG(file_stat.st_mode) and file_stat.st_uid == expected_uid
            and file_stat.st_mode & 0o022 == 0):
        raise RuntimeError("授权文件归属、类型或权限异常，停止操作")
    if not (stat.S_ISDIR(dir_stat.st_mode) and dir_stat.st_uid == expected_uid
            and dir_stat.st_mode & 0o022 == 0):
        raise RuntimeError("SSH目录归属、类型或权限异常，停止操作")
    spec = compatible_expiry()
    new_line = ('restrict,expiry-time="' + spec + '" ').encode() + KEY
    fd = os.open(str(path), os.O_RDWR | os.O_NOFOLLOW)
    with os.fdopen(fd, "r+b", buffering=0) as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        opened = os.fstat(handle.fileno())
        if (opened.st_dev, opened.st_ino) != (file_stat.st_dev, file_stat.st_ino):
            raise RuntimeError("授权文件发生变化，停止操作")
        before = handle.read()
        lines = before.splitlines(keepends=True)
        matches = [i for i, line in enumerate(lines) if line.rstrip(b"\r\n") == OLD_LINE]
        key_lines = [line for line in lines if KEY in line]
        if not matches and key_lines == [new_line + b"\n"]:
            return {"status": "XIANGQIAO_VI_TIME_FIXED_ALREADY", "expiry_local": spec,
                    "expiry_beijing": "2026-10-05 21:00", "sha256": hashlib.sha256(before).hexdigest()}
        if len(matches) != 1 or len(key_lines) != 1:
            raise RuntimeError("未找到唯一且完整的本次授权行，停止操作")
        index = matches[0]
        lines[index] = new_line + lines[index][len(OLD_LINE):]
        after = b"".join(lines)
        backup_fd = os.open(str(backup), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(backup_fd, "wb") as saved:
            saved.write(before)
            saved.flush()
            os.fsync(saved.fileno())
        if backup.read_bytes() != before or path.read_bytes() != before:
            raise RuntimeError("备份不一致或授权文件发生变化，停止操作")
        if time.time() >= DEADLINE:
            raise RuntimeError("原授权已过期，停止操作")
        try:
            handle.seek(0)
            written = handle.write(after)
            if written != len(after):
                raise RuntimeError("授权文件未完整写入")
            handle.truncate(len(after))
            os.fsync(handle.fileno())
            handle.seek(0)
            if handle.read() != after:
                raise RuntimeError("写入核验失败")
        except Exception:
            handle.seek(0)
            if handle.write(before) != len(before):
                raise RuntimeError("恢复未完整写入，请保留备份并手动核对")
            handle.truncate(len(before))
            os.fsync(handle.fileno())
            raise
    return {"status": "XIANGQIAO_VI_TIME_FIXED", "expiry_local": spec,
            "expiry_beijing": "2026-10-05 21:00", "before_sha256": hashlib.sha256(before).hexdigest(),
            "backup": str(backup)}


if __name__ == "__main__":
    if os.geteuid() != 0:
        raise RuntimeError("请在已登录的root终端执行")
    # Use the server's configured system time zone, not a shell-only TZ override.
    os.environ.pop("TZ", None)
    time.tzset()
    result = repair()
    print(result.pop("status"))
    for name, value in result.items():
        print(str(name) + "=" + str(value))
