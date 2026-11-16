#!/usr/bin/env python3
"""Back up explicit public static references without executing remote code."""
import concurrent.futures
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
DEST = ROOT / "public-static"
HOSTS = {"nong.cloud", "m.nong.cloud", "nc.nong.cloud", "api.nong.cloud", "work.nong.cloud"}
SEEDS = ["https://" + host + "/" for host in sorted(HOSTS)]
# Explicitly documented public browser prototype, not a guessed server path.
SEEDS += ["https://work.nong.cloud/miniapp-preview/"]
# Resolved directly from preview/runtime.js: new URL('source-bundle.json',
# new URL('../', document.currentScript.src)). No hidden path discovery.
SEEDS += ["https://work.nong.cloud/miniapp-preview/source-bundle.json"]
EXTENSIONS = {".js", ".mjs", ".css", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".mp4", ".webm", ".woff", ".woff2", ".ttf", ".otf", ".map", ".json", ".webmanifest", ".html", ".wxml", ".wxss"}
BLOCKED = ("/api/", "/api/v1", "/open-api", "/actuator", "/private-attachments", "/uploads/")
MAX_BYTES = 24 * 1024 * 1024
MAX_FILES = 750


class AuthorizedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not authorized(newurl):
            raise ValueError("Redirect outside the authorized static scope")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def authorized(url):
    u = urllib.parse.urlsplit(url)
    return (u.scheme == "https" and u.hostname in HOSTS and u.port in (None, 443)
            and not u.username and not u.password
            and not u.query and not u.fragment
            and not any(part.startswith(".") for part in urllib.parse.unquote(u.path).split("/") if part)
            and not any(u.path.lower().startswith(p) for p in BLOCKED))


def static_reference(value, base):
    value = value.strip().replace("\\/", "/").replace("&amp;", "&")
    if not value or any(c in value for c in ("\n", "\r", "${", "<", ">", " ")):
        return None
    if value.startswith(("data:", "blob:", "javascript:", "#")):
        return None
    # A query-only JavaScript string is not an asset reference; urljoin would
    # otherwise turn it into repeated downloads of the containing bundle.
    if Path(urllib.parse.urlsplit(value).path).suffix.lower() not in EXTENSIONS:
        return None
    # Vite's generated dependency tables store paths relative to the release
    # root, while import declarations use ./chunk.js relative to the bundle.
    if value.startswith("assets/") and "/assets/" in urllib.parse.urlsplit(base).path:
        base = base.split("/assets/", 1)[0] + "/"
    url = urllib.parse.urldefrag(urllib.parse.urljoin(base, value))[0]
    u = urllib.parse.urlsplit(url)
    if not authorized(url) or Path(u.path).suffix.lower() not in EXTENSIONS:
        return None
    return url


def references(data, url, content_type):
    if not any(t in content_type for t in ("javascript", "json", "css", "html", "svg", "text/")) and Path(urllib.parse.urlsplit(url).path).suffix.lower() not in {".js", ".mjs", ".css", ".json", ".map", ".html", ".wxml", ".wxss", ".svg"}:
        return [], []
    source = data.decode("utf-8", "replace")
    if url.endswith("/miniapp-preview/source-bundle.json"):
        bundle = json.loads(source)
        values = []
        for content in bundle.get("files", {}).values():
            if isinstance(content, str):
                values += re.findall(r"[\"'](/?assets/[^\"'\s]+)[\"']", content)
        base = url.rsplit("/", 1)[0] + "/"
        return sorted({ref for value in values if (ref := static_reference(value.lstrip("/"), base))}), []
    values = [match[1] for match in re.findall(r"([\"'])([^\"'\r\n]{1,1024})\1", source)]
    values += re.findall(r"`([^`\r\n]+)`", source)
    # Literal backtick characters can occur inside quoted minified error
    # strings. Anchor resource templates on an explicit URL/path prefix.
    values += re.findall(r"`((?:https://|/|\.\.?/)[^`\r\n]{1,1024})`", source)
    values += re.findall(r"url\(\s*['\"]?([^)'\"\s]+)", source, re.I)
    if url.endswith("/miniapp-preview/preview/runtime.js"):
        # Module filenames in this runtime are keys in source-bundle.json,
        # not independent network resources.
        values = []
    # Resolve explicit brand helper templates such as /brand/${image} using
    # the image filenames in the same bundle; do not execute the bundle.
    brand_bases = re.findall(r"`([^`\r\n]*?/brand/)\$\{[\w$]+\}`", source)
    image_exts = {".svg", ".png", ".jpg", ".jpeg", ".webp", ".avif"}
    resolved = []
    for value in values:
        if "/" not in value and Path(value).suffix.lower() in image_exts and brand_bases:
            resolved += [prefix + value for prefix in brand_bases]
        elif "${" not in value:
            resolved.append(value)
        else:
            # A bounded literal conditional in a template has two explicit
            # resource variants, e.g. the normal/reverse logo.
            match = re.search(r'\$\{[^{}]+\?"([^"{}]*)":"([^"{}]*)"\}', value)
            if match:
                for variant in match.groups():
                    expanded = value[:match.start()] + variant + value[match.end():]
                    if "${" not in expanded:
                        resolved.append(expanded)
    values = resolved
    maps = re.findall(r"[#@]\s*sourceMappingURL\s*=\s*([^\s*]+)", source)
    values = [value for value in values if Path(urllib.parse.urlsplit(value).path).suffix.lower() != ".map"]
    values += maps
    found = sorted({candidate for value in values if (candidate := static_reference(value, url))})
    map_refs = sorted({candidate for value in maps if (candidate := static_reference(value, url))})
    return found, map_refs


def fetch(url):
    opener = urllib.request.build_opener(AuthorizedRedirect())
    req = urllib.request.Request(url, headers={"User-Agent": "nong.cloud authorized public-static-backup/1.0"})
    fetched_at = dt.datetime.now(dt.timezone.utc).isoformat()
    try:
        with opener.open(req, timeout=25) as response:
            data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise ValueError("Resource exceeds the per-file backup limit")
            final = response.url
            if not authorized(final):
                raise ValueError("Unexpected final URL")
            u = urllib.parse.urlsplit(url)
            relative = u.path.lstrip("/")
            if not relative or relative.endswith("/"):
                relative += "index.html"
            target = DEST / str(u.hostname) / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            content_type = response.headers.get("Content-Type", "")
            refs, maps = references(data, final, content_type)
            metadata = {"url": url, "final_url": final, "path": target.relative_to(ROOT).as_posix(),
                        "fetched_at_utc": fetched_at, "status": response.status, "bytes": len(data),
                        "sha256": hashlib.sha256(data).hexdigest(), "content_type": content_type,
                        "etag": response.headers.get("ETag"), "last_modified": response.headers.get("Last-Modified"),
                        "explicit_source_maps": maps, "static_references": refs}
            return metadata, refs
    except Exception as exc:
        return {"url": url, "fetched_at_utc": fetched_at, "error": str(exc)}, []


def main():
    if DEST.exists():
        raise SystemExit("Refusing to overwrite an existing public-static snapshot")
    DEST.mkdir(parents=True)
    seen = set()
    pending = set(SEEDS)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        while pending:
            batch = sorted(pending - seen)
            pending.clear()
            if not batch:
                break
            if len(seen) + len(batch) > MAX_FILES:
                raise RuntimeError("Static reference graph exceeds the file limit")
            seen.update(batch)
            for metadata, refs in executor.map(fetch, batch):
                results.append(metadata)
                pending.update(set(refs) - seen)
            print(json.dumps({"attempted": len(seen), "saved": sum("path" in x for x in results),
                              "errors": sum("error" in x for x in results), "pending": len(pending)}), flush=True)
    manifest = {"scope": "Public HTTPS static deployment snapshot only; not complete server source, backend, database, secrets, or private files.",
                "created_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(), "seeds": SEEDS,
                "allowed_hosts": sorted(HOSTS), "reference_policy": "Only explicit same-authorized-host static references and explicit sourceMappingURL links. Query URLs are rejected; URLs are deduplicated before fetching. Vite dependency paths and bounded brand image templates are resolved from the downloaded JavaScript without executing it. No guessed .git, credentials, source maps, or business API requests.",
                "deduplication_note": "An interrupted preliminary parser run generated redundant bundle copies from query-only strings. Its entire task-owned download directory was removed before this final snapshot. This final run rejects all query URLs and deduplicates canonical static URLs.",
                "files": sorted(results, key=lambda x: x["url"])}
    (ROOT / "public-static-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "PUBLIC-STATIC-SNAPSHOT.md").write_text("# 公开静态发布快照（非完整服务器备份）\n\n本目录通过公开 HTTPS GET 保存 nong.cloud、m.nong.cloud、nc.nong.cloud、api.nong.cloud、work.nong.cloud 五站首页及明确引用的同域静态资源，并保存文档明确的工作台 `/miniapp-preview/` 浏览器原型。其运行时明确加载的 `/miniapp-preview/source-bundle.json` 保存了该原型公开提供的原生小程序源码。远程代码未执行。\n\n**尚未完成服务器全部代码备份。** 本快照不包含原 8080 后端源码、旧 PHP 业务源码、服务器私有文件、数据库、生产环境配置、私密附件或凭据。线上编译 JS/CSS 不能替代原始 TypeScript/Java 源码。\n\n请求限于明确引用的静态文件；所有带 query 的 URL 均拒绝，规范 URL 去重。业务 API、隐藏 Git、凭据端点及未明确引用的 source map 未访问。初次解析产生的重复临时文件已全部清理，本快照来自修正后的独立获取。\n\n逐文件 URL、获取时间（UTC）、SHA-256、HTTP 状态和引用关系见 `public-static-manifest.json`。下载失败条目也在清单中保留。\n")
    print(json.dumps({"completed": True, "files": sum("path" in x for x in results),
                      "bytes": sum(x.get("bytes", 0) for x in results),
                      "errors": [x for x in results if "error" in x],
                      "explicit_source_maps": sum(len(x.get("explicit_source_maps", [])) for x in results)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
