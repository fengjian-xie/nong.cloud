#!/usr/bin/env python3
"""User-run setup for one expiring, forced-command project backup key.

This script is prepared locally. It must be reviewed and run by the server
owner in the already-authenticated Workbench terminal. It does not run a
backup, restart SSH, open ports, or grant an interactive shell.
"""
import argparse
import base64
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import stat
import struct
import sys
import tempfile
import time
import zlib

EXPECTED_HELPER_SHA256 = "d92c06c126cf714aed78124ac2bcd5179e69a5cffda529b8a5c1eeca1f5edd89"
HELPER_ZLIB_BASE64 = "eNrFPPtz3LbRv+uvYNjpV9K5ox5OnFRfzjOKLSeqZckjqUk7iobDI3E6RjyS4UPSWdX/3n0AIPg6yUlm6mlzIAgsdhf7Bqi/fLFdl8X2PE63RXpr5etqmaUvt2zbfpcVoYimYbZaBWlkLUWSi2LfitNbkVZZsbaywhL3eVZU1nf/OD89sYKiCKB3YQwpsqwqX3tbW+cVwAiKaJrE8yLAyWmy9qyTzCoBcDKxCrHKKmHdFXElyokFuMRFlq4AznaYZTex2L4RAE8EUTnZgpWDYh5XBEkhKO5FWFdxlnrW4a2AFxK5uLTyIr4NAHou0ihOr60kC4MEgN3G4s5DWrfiFY2NYFQVr4R6XqSroAqX6nEZlEsgQD3GmWr9WmapasMMPSErtxZFtrJy6IOJluz+WBfiY1bG9x+NsYVetayCSrfreV5koShL3bPWzSooFnGi5xHmW+dvDk78s9PTi3NrZjn29m1QbN/d3dkTy97G/aDGMlsJamQ5d5TFLf0CBwJq4BR36/3J6c9D0LbTLL32wiSrIxqtuu/jIL3+LQ6yaZDH9mTLav8bGqhRUa8WdZBOC5GIoBTl82AQItNFUKzGsZkij4LkeQDvsuIGyP9wcPb+8AxJf7C965hYlQfhTXAtPNxzes5W3v0qwea8jpPIuy6CKBHdZ++m6hBjX2feKiP+vQkKeKgyBpOvYct/FWGlewrxWx2DioA6lF51X3UAgQrkWSkKjRMoBKKYr/EhyHP94gexQomxH7fO3x999N8edYjzltf0U96m/Fsu6Te4K/k3idd1qprzYB5IGWgz1fbCLF3EDOs6rXNuRVl4IwpqhkG4JB55aU6b5pFS9gGBKSHJVL9pFgkf2FYnopT9UUYwfT9fE1jf74EJCxEB8+IgoUmlgI6KmmxdZG9Zgv2gdp0nGdiaptkDGVQVLEZbQpvGNmba6U6ya/VLqzHZHVDVKseXleDf/FppYX7t3wUkAat1+ZsUhSgmiFG9ykvcyMM3Z4cX/snBh0Pey6AGG17En0Tkg82ksTdpdpf6y6xkpLxUVEVIrfw6D0ruXK29MF309YP3SI1f57FsgshMO3z15mAh/WVcovUfhPTJfN/ivglKU/Xx4OLi8OyEjY8nRQB/vRfYiiO/KAPVjJqmCM2HaO/rr3f//mIAoY5sMFSJFD+88HKx4gZwU/bs7snG4n4E6Avv15tST0N6hXyK5tyQEgFA4ogbJajHKDjYfnCNciC1X/KDgrdSjUI1gmwxCg6lh0fNgxsN1bv+1LTnn/aah/tPo6A+xRISuCPd0JAq1fjmExjUj2dHPx1cHLb3FQxUEocB+m7gRpFBnFFJoWi9WrMxbPcFq2QYM1hzCsAiuY3UrkMKEOQuo4VSm9w8DcMqRVVB6FBKm0rGyu90otaCAgiGGc29fJmPwbvLp3JJGqTQqQuiS3XmQRGsRCWKkokfhiXNv2ZQ8xxwB9vdqepvKB7lnAfe5DYOpbwhNu4WOAv/3fHBD7hpWemd+mdvT0+O/239h5/g9eGbi9Mz3XFy+u70+Pj05613R8eHm2aqgc3zyffHp2/eb21thQlYJ+tMLOpSRM7hfShy5I+7T3ij6dKDDkKMkn6OwR3c8etILCzfj9O48n2nFMliYt0GSS3kbPxXFev9FgtwmBdBmJnEqQB0F2D7K4en6YGC8LCci3UuDosiKybWTziC2m4bYBHEpdAU2Iv4XkRWQLhaeh2IUVcxOB+ITSG2hfgZnGtkNwuC+QZcML7z8D9O8yZewEsOOr24XCCxwmkR4SJIHINAvusQ+N2Mur+0vtnb2f19iEOYDaFJxOlAKERUWtVdZi2zuigNEmjdok4Rfz+JV3GlKFplgF2WxqHjAiKvdna29O6BswxviByDq0CywQnr9axDEyDSg6sGtRD4HfQibJFOV3FaQz6hUg8mB5ITwBe3TYnkxwwM1XpUGMswSH1KkWZN0D6x2FlzvxF/D6jqKrj3I5DE5ezVhB/iopzt7cA/fsZYr5zt7jQ98zXkV7OvrRfW7s7eVy9evBwAy0T7d6RKs5MsNTWG2NhgjpsIARLInO7q7LlBjh5s9HVGa5ImxjNQBVONV6q3P5coNuYSvXKyfKe727NbVMOM1vPTIjkAA5QDmff71EqG/FFXhVpLeIwNShzhFqQo7+CZMOF0TGMn7UQMNgbSyzQU/BY4VRXaQlAXPiQilbOt19ZXO39/1dDQwV/aKsr0Kc2V+GITmNjKdE0zCvg4qZwChssP5mWWgE45hAwj8sWMXwelnyMM891sBnmb3eIsvLN/+cUG89kQEqRrJysiJ3TB9L3csxbQF+oRbnc+DgefW+EIiDcp2PRsl6apfkIJH0rXHWUL7IPejB5vIPWoC4mC3DmIeVgfHBwn4dq2fQr9lqByBnGUXHgK0ap1F0OUX1eAWpJkd+g5AquEACBObyaAZpjUVOrArcbos/SwzIFQO0JC69GLRcTuGXGBTB+I1x6fB7ScpcmS9i4TRObQ5e7+VVv8wyWkxMY6OMxYaGKBWvuLaLaIOptTYrWhFE73BWFNUJu9YP4uuEc66+8hMNPxQ4PTIFzaTLkzMB1YCblUCpGYg/8B9pZofSBBhyxm9g7yBqVlsBOiAHxwmEcPTlvc8QVpG/52hAzld5vEV41S4ozPQ6I6KNk4uCWZzA27TstgIYgMW+HE+MKkVhIpocvilyd/Q2CgQxMmVi5VwpiqIvqBlZsEy1f+Nyv8oIBdu21wMZlqkVfVyKlSRR+03h091TZVDM2v3Md5AUl8o2JAAzlnia4c77DZIttikYDDI+o8jTXcXnc3RjQAFXXWtYKy+uYqqx2gAgMJss7nh3fREIot7RtVYint0hD1GEbCqjg+xhLlDtgagrUDjwHKjBbHAXuyhNdfIodYCGTPEJfczesj/LZ6sTW4KNDxPNvAbFqlbbLI8LQtrcm003MK4DeA61kLOQIxbnxwFGMduXRa2yeZoxw2m9A6jSaWwEUhLrkF51wJ6KhASyC/FYjuw+PE2qH/MRY6DgkiJSUQd5Y6JcJ/f7FO0GVAoHMjgMkW6l4hLJQ6qu9ul+uyEiuIJ1AH1QZyuTyYJ8Iz45rNetPmlOEcgDLIISvANKgTNRU6HNf1EHWJdEMPSg2wdWLxUAr0jEVA3Llqr7mk2Ka5pccOsBr/yZnWlzNr16RQ9b9WE1V02SbR3BXa7w3099JKlG4MQ0tgMcQHIEdJXFawCEpSL7HsCSK9I3rb2A+yvvEutGobyghvBpGmFCOLBLtrPJWQ/k/76IkMP3wZeZTSG8JgrNG2ebSJuE0Ekr3LQIbTDtMxppWUqkI9+g0HMfXO/aPzs8MfHESDLBrhTradit00VI8E78IjXbePWKNq9ioobkSxb4MBJD/bxcchucV005Ql6pNGtb/kYAmGs+le5MGmEbNQJY0D+A4ya3B3u9EYL/J0NPanb+UgdmQSCEW2Cux1JOuliYCn3U5AGKfgUQfAaeNNIKXpWWzy8vtPmZQe2qMu5imu9bjSr0y1DeROA3eQ4sHAFksnSnDaw+dgkG/GOGKk6/9LlgySZCgno4knkz5adL8qhFDpKMdWZIPRzfnf7ny7I7Ee9MyFmkJsULMvbd20jcQGIjaEy6+8a/ByNnTZLb7jGDQ5Q9Ee/H/EryJ19NbWWPsNaBW1Xj7YlF7uS9mw2buW0CEdjuxwH/X2qriBCJSj2G0D61Yl+OmrdmnowZaOUsfaWKPfbxyyTYrDqg/9yj/bWuKgU7e7R2CaPCRC8fhRhcjGlu3LiA0P+zFYwWxL3FeOkzcpCYTY6lIDn23RY2k8G03VPWyHefNA8nJVYU0gTHVpK6GXqzFOPsGHf/mn7113QlmHTvsMTHv1ILl/DzY6hRqZZoNE1GlwG8QJTuGDRSVx+9bl1WM/rC1ECSEWBhf6rgDWOZ3LZmkAM/0RgU2TKqWThZJuDMysfeL51WSM+Mb8VFFWVzNjjY9HHw+xfhTBTpv9bw9/Ovnn8fHTIDETRJhfT7iqxsEDXf6YPdjHb/yD42PkyRtEGPLLH/FBb+W+2uN9+Qj/sR9bAb0j7crEZM0Fr3rIZWv3qd1YwFaIaGwjTLtyedXYjjgy1OohTivHTJkL4YHNjsAUOMXchsEz55foS9eeyL30mNnu46aTCjY6IHYFVw1vQOoRne2/RttoIqy/IhrPNLUEi7Jlbd4VZV6Q470Z5wERRe2MUddxhX2c99gyRSbzshsbFUCSxANCCidn1o4lYKs3MLixAdIE6EtF7bSKnNKEoircg372NWbiNcKwUpWFWYIoo++YIj/xetJ0HoQ3dT693eWTewmZ/SCM5qW32seEMAxePdyI9b6sQuKuw6M8eyKxQGSVmUUW4dWmL2amEXzswDXNI02/NLo62mvTcQRi+MAmWcegyNdOWEoxrSyNt19ztXxMiWkW2PJslRe4TxGX1NsgqOuxxyIIBkitFUetlagCTEybW2FBcX3bugUGJoJP5aHRnNdjJIx4UqxAl2PsLuPquTos9hkzXPogSaxFDQIgZNpbwopi8z0xW0kiLujTAQ+41QRA3wp9HjlQ9NZjtlQiaMm69lCVkPpgea622Hj2brO30RUZNYU93Sq+5jNjuiWiHkrbMDdNxfpyf7o7UC9RZTS67ZIyvbCjsDYW6tSxtk93BszizVCFkGNzWLISRaqqOPRAhZzO+f8ALuoiDaPROxpHjPJl7svzkdKX43053lRuu8zqgg6xjUIgbV9jTVCL/UU3/pJHRSoFI+s+QQuv6xV3QXIjw/GiVekaiYvNvHy4CvDsRF1JlEV1Su/XLOY6OiRcnOVO3Gdk9mX1+Xn95yWBknmGA+EgVeGvA1VytYCG8gWP7vOyRp4NZAylyq1Eu6xUScLt5ewM5Q/iz40O4iLBg0GFx/HJexOPP8ww3ho/xVqfz/vV510bhQ4r+ijgmYA8lSnp1PzVV/uDLuDzcGUjyx6Hz96H9nh0n/9IqWJU/vEfKbGuMGzQoI2FhaHiQm8PWrUfLEwZ+4BujB9T3FKMBXb/sHjkIsQTFzJ3YDOXQUFRYl9ASjFQGAKLeg3mcdLo2JDbG5IfNZVKbcqx/AlCNKhhT4oNGfJN8BW6GM1qom0VzPCulPEn8eiOKQst4bbLx9Q3THTvAgCFL3VayWskfIlGH/yTiGon5bit6LXjplqHyZLEZu7nBytY0Bw+oNcuaPiMXp/sk1INnrIPnH52zoJaB0HPPnnnY84GQfkVgHH8rs65ozpXzHnifLsTQP3PTrSbJWT0OLGau3W9hXr2qrWiuqP0Nr4WZXUGOY8oxm8qVaB9KxUjTax5HV2LavhqkBzKd7IIuHzgyVinkEPk5xReuQz2vn7luAp+GyCvBdNkA8+kZKskQUMsOJ180Hq789hEapjPKTpAkWfT3S7OI7FWIVYBsAESgVlrXHOvaGqieClXv2pdC4IVre+snU4tF3tnzQK9Ga+bdxuvDwVhVUOKIoUcKbUQiWFTQgzBNGtmbpXH/IFV3SHGa6qwmo/mDiG4vZtP3cGvhzn25xJjyJhX55hKdrCTeoOd+joHRSKUu6NQiJBql0qws7rK62r8yFbd4zDuUTVAMJjX5k91q+tU6hkdxcu9IZPYgZvLu1na/DUQNMiqAeuiKW4tNG4jNYc5hbICq07j32phtb/j2rWqDK+WdL7nkhugi5RPVl9kyRtPsxHAJXvhK6KM7kYBcRraoy6iqVeKoNHbDziwJZE0M5WAefGNgoeMABkS8hqbtCtBalCuSZPUox2ms/qsApHl9HBn2IuM0/FEntc5OWmT2SDRj25gILjVBVbo0PHbVLfrWFsc5AkqyOGZ/FLcsyI57uX+7qurx+6hWjcf7qTRRgY9gOIleE2loXwntQNwphqdxJW4+yWWtlfOorEuyFYsCTJe7fMtmvK6V4aiGBugoIoUlzYXvK5Yvej2CmP6dBw3rEtkqJpq1Gg4x9d203ghKP9+fvkRuvHsBZLkugphsPpU0dONNLtz9AP+5xM4Rg9GuxC/ZUDnChJ9d+TG/3CdTJZr9lGLLPwkQDCF+npqq0T2/8CbO6tdv9mW41d1ySo5Fxavlawt/rIKJNg6SiE3BCEGaUrWlqpAUd2rEFFAhjTM8hghgXFSQMol9JcCP5OoRLL2Rr/eUDXHc2WVBzS7lOXHQxRF+hDMWgkwAtUSDIKyCdbdMkvEVPKCt4gqlqpK1qpPGlVLVUmh6JlvwUn6ufbIcgS8GKeBSstkazEvklVodRLBF7fRgbK8U+YW+Tp62pm0wyOdAseQBsgPSTm6xFY2/3XGvnBCV0Bm9t1/6EMeFqOZmvDx4F/+u9OzDwcXrhUgIXSnr3MAbNhAVrJ+YrTBCrIfD7MiYn1pbJxyJPhNEC/sk6Xjd9DEN6qyjQZaXxfUg3SHwcWuml5KXl8pQ8vYDBQI8BocXqzCIx4CL63McCL4BM0dD2Cmc5do24EeXEwxYRgA7S7E/YuItxa9QTG3abM4/NvfGj/x46xmQRVCGSwiRWnmuKOnpdafUut4MmFeBuk1qDEEKAHkPaUKMap1LqyoLjBoZ40aP9dtqQs5GZ3sbyKuNavvZz6LFhnxEoct05OM+o4eQukiw88qpD5eBMUR9DgsGbq2caWvzjS6obueliK1kIe8mXATN1M1yZiZ/Guqrx9O3x62tv//rJ3sm2++wamVeoHzNwpUjxysLXUOCjYzXuOMpjDDj4xGt4hSYRhmZsZONwM2jOsGAWOrhBce6d4AIjGRC2yYtaho/c9XPTZM2uz0AkNzpw2jqd4ii7iqMFD/evo4v++xKNLk0h1QrDI1I9Rs19+6u/w7lpR2wWcT4OPCANhpS6aWOT8tKW1yiOXNEP2oR3XC4cY1tI5AKSZWMeqsZSlGppMYdaYZotUvKRg5vIMf9dOHvKWjIOKZaVkXwg/KMI7VhYqYAqvZHn5fZ/+S2q4O/J+bioyYGfv88Oynw7Pp9wdv3v/z4/TDwcnRu8PzC/5zA30IXfthGRWFyYBaDutPnHnfI1eOTnnmSLXrqbBDV8Maj6quG0F85stv+xz52y0RqPvHQ5fzR/jY/wRLw1YfYSE3ZCcmIruvXn771cbsQ31+JSd1rpzJzxPRWOp4t2MnmRqP/u6KY0pU777FkGj1Bcq4b5I0KJhfEKiMyXb3n3FIqeL1Gf2NFY/iZcWiS2SXAe5q8HzSaT7NnQDjwrrA2H7oU91nVUqaEondXe45laWt8XOXztKYjBhpCv+JG8IGUZhylYZuLYgCgoWqFSbIwtdO6zaUBD2x9LUokzWGbjNzMEaEqeZ3BW8zEmERLjMLQBVaxECA8UN4Cu7ozH2bD+2bixlN9gu2MrjmeKHA7z9c/vpHawV0TRQbXHlPiDwaf7VAf/yH7AKqNV8KsOTB8Vb7AvKAWD/Y9AqcgsQDLyiuKTnEH8LH8+kEwvcfN8m3ZPGeYTPwb/34xqUVp3WB5WnDob89Nb9lN4Hw3dKT05MffDa5/tvDg7fHRyeHtjv0/U9vC5/BF7UrDWNsCc1+Hj+MB9OQ9sg4P//RPz07+uHo5ODYf3P6AbzHWyx12O6o4+cPqp32B8r84/YYDBsT40kG7yVZQd/Horrv2/qjWKqYrksPLxy5nWQE+/l6o2TY3zSX7DRTsj+lL3Zhfk1/9MVQx8df0r+5LWjiPq6cPe7Tz4OSA95JPk4UHkCeN68XC/wAz0CNu2Aj/gvuznhW"
LIFETIME_SECONDS = 7200


def validate_key(public_key):
    fields = public_key.split()
    if len(fields) != 3 or fields[0] != "ssh-ed25519":
        raise ValueError("Expected one Ed25519 public key with a task comment")
    if not re.fullmatch(r"nong-code-readonly-[A-Za-z0-9_.-]{1,100}", fields[2]):
        raise ValueError("Invalid task comment")
    raw = base64.b64decode(fields[1], validate=True)
    if len(raw) != 51 or struct.unpack(">I", raw[:4])[0] != 11:
        raise ValueError("Invalid Ed25519 key encoding")
    if raw[4:15] != b"ssh-ed25519" or struct.unpack(">I", raw[15:19])[0] != 32:
        raise ValueError("Invalid Ed25519 public key")
    return fields


def checked_directory(path, expected_uid):
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != expected_uid:
        raise ValueError("Directory must be owned by the server account: " + str(path))
    if info.st_mode & 0o022:
        raise ValueError("Directory must not be writable by other users: " + str(path))


def write_new_private_file(path, data):
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
    fd = os.open(str(path), flags, 0o600)
    with os.fdopen(fd, "wb") as target:
        target.write(data)
        target.flush()
        os.fsync(target.fileno())


def authorize(public_key, helper_bytes, root_dir, expected_uid, now_epoch):
    keytype, encoded_key, comment = validate_key(public_key)
    checked_directory(root_dir, expected_uid)
    ssh_dir = root_dir / ".ssh"
    if not ssh_dir.exists() and not ssh_dir.is_symlink():
        ssh_dir.mkdir(mode=0o700)
    checked_directory(ssh_dir, expected_uid)
    auth_path = ssh_dir / "authorized_keys"
    # O_NOFOLLOW and the descriptor checks preserve existing authorizations,
    # ownership, mode and inode while refusing symlink/special-file targets.
    fd = os.open(str(auth_path), os.O_RDWR | os.O_APPEND | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    helper_dir = None
    appended = False
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != expected_uid or info.st_mode & 0o022:
            raise ValueError("authorized_keys has unsafe ownership, type or permissions")
        if info.st_nlink != 1 or info.st_size > 8 * 1024 * 1024:
            raise ValueError("Unexpected authorized_keys layout")
        os.lseek(fd, 0, os.SEEK_SET)
        chunks = []
        remaining = info.st_size
        while remaining:
            chunk = os.read(fd, min(65536, remaining))
            if not chunk:
                raise ValueError("authorized_keys changed during inspection")
            chunks.append(chunk)
            remaining -= len(chunk)
        original = b"".join(chunks)
        if any(encoded_key.encode("ascii") in line.split() for line in original.splitlines()):
            raise ValueError("This public key is already authorized; no duplicate was added")

        helper_dir = Path(tempfile.mkdtemp(prefix=".nong-code-backup-", dir=str(root_dir)))
        os.chmod(str(helper_dir), 0o700)
        checked_directory(helper_dir, expected_uid)
        helper_path = helper_dir / "readonly_export.py"
        write_new_private_file(helper_path, helper_bytes)
        deadline = int(now_epoch) + LIFETIME_SECONDS
        # OpenSSH 8.0 interprets this format in the server's local timezone.
        # UTC's Z suffix is intentionally not used (introduced in OpenSSH 9.1).
        expiry = time.strftime("%Y%m%d%H%M%S", time.localtime(deadline))
        forced = "/usr/bin/env NONG_BACKUP_DEADLINE=" + str(deadline)
        forced += " /usr/bin/python3 -I -B -S " + shlex.quote(str(helper_path))
        escaped = forced.replace("\\", "\\\\").replace('"', '\\"')
        line = ('restrict,expiry-time="' + expiry + '",command="' + escaped + '" '
                + keytype + " " + encoded_key + " " + comment + "\n").encode("ascii")
        if len(line) >= 8192:
            raise ValueError("Authorization line is too long")
        prefix = b"" if not original or original.endswith(b"\n") else b"\n"
        record = {
            "comment": comment,
            "deadline_epoch": deadline,
            "expires_server_local": time.strftime("%Y-%m-%d %H:%M:%S %Z", time.localtime(deadline)),
            "helper_path": str(helper_path),
            "helper_sha256": hashlib.sha256(helper_bytes).hexdigest(),
            "authorized_keys_original_size": len(original),
            "inserted_separator_newline": bool(prefix),
            "authorization_line_sha256": hashlib.sha256(line).hexdigest(),
            "authorized_keys_sha256_before": hashlib.sha256(original).hexdigest(),
            "authorized_keys_sha256_after": hashlib.sha256(original + prefix + line).hexdigest(),
            "scope": "Forced inventory/export of project candidates; no interactive shell or forwarding",
        }
        write_new_private_file(helper_dir / "grant.json", (json.dumps(record, indent=2) + "\n").encode())
        current = os.fstat(fd)
        if (current.st_size, current.st_mtime_ns, current.st_ctime_ns) != (info.st_size, info.st_mtime_ns, info.st_ctime_ns):
            raise ValueError("authorized_keys changed concurrently; no key was added")
        os.lseek(fd, 0, os.SEEK_END)
        pending = memoryview(prefix + line)
        while pending:
            count = os.write(fd, pending)
            if count <= 0:
                raise OSError("Could not append the task authorization")
            pending = pending[count:]
        appended = True
        os.fsync(fd)
        return record
    finally:
        os.close(fd)
        if helper_dir is not None and not appended:
            # Only files in this invocation's newly created private directory.
            for name in ("readonly_export.py", "grant.json"):
                item = helper_dir / name
                if item.exists() and not item.is_symlink():
                    item.unlink()
            helper_dir.rmdir()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("public_key", help="The task-specific public key; never a private key")
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit("Run this reviewed setup in the root Workbench terminal")
    if not os.access("/usr/bin/python3", os.X_OK):
        raise SystemExit("The required system Python 3 is not installed")
    validate_key(args.public_key)
    helper_bytes = zlib.decompress(base64.b64decode(HELPER_ZLIB_BASE64, validate=True))
    if hashlib.sha256(helper_bytes).hexdigest() != EXPECTED_HELPER_SHA256:
        raise SystemExit("Embedded helper checksum mismatch; no key was authorized")
    record = authorize(args.public_key, helper_bytes, Path("/root"), 0, time.time())
    print("NONG_READONLY_BACKUP_READY " + json.dumps(record, ensure_ascii=False))


if __name__ == "__main__":
    main()
