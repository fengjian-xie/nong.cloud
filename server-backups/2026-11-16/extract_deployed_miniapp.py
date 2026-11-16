#!/usr/bin/env python3
"""Extract only text source embedded in the publicly deployed preview bundle."""
import datetime as dt
import hashlib
import json
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent
BUNDLE = ROOT / "public-static/work.nong.cloud/miniapp-preview/source-bundle.json"
DEST = ROOT / "deployed-miniapp-source"
ALLOWED = {".js", ".json", ".wxml", ".wxss", ".wxs"}


def main():
    raw = BUNDLE.read_bytes()
    bundle = json.loads(raw)
    files = bundle["files"]
    config = bundle["config"]
    if not isinstance(files, dict) or not isinstance(config, dict):
        raise ValueError("Unexpected bundle structure")
    checked = {}
    for name, content in files.items():
        path = PurePosixPath(name)
        if (not isinstance(content, str) or path.is_absolute() or "\\" in name
                or ":" in name or not path.parts or any(part in (".", "..") or part.startswith(".") for part in path.parts)
                or path.suffix not in ALLOWED or name != path.as_posix()):
            raise ValueError("Unsafe or non-source bundle entry: " + name)
        checked[name] = content.encode("utf-8")
    if DEST.exists():
        raise ValueError("Refusing to overwrite an existing extraction")
    DEST.mkdir()
    entries = []
    for name, data in sorted(checked.items()):
        target = DEST / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        entries.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "bundle_field": "files[" + json.dumps(name) + "]"})
    if "app.json" not in checked:
        data = (json.dumps(config, ensure_ascii=False, indent=2) + "\n").encode()
        (DEST / "app.json").write_bytes(data)
        entries.append({"path": "app.json", "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "bundle_field": "config", "note": "JSON serialization of the deployed config object; original formatting is unavailable."})
    manifest = {"scope": "Source text embedded in the deployed public browser prototype only, not a complete native WeChat project or server backup.",
                "source_url": "https://work.nong.cloud/miniapp-preview/source-bundle.json",
                "bundle_path": BUNDLE.relative_to(ROOT).as_posix(), "bundle_sha256": hashlib.sha256(raw).hexdigest(),
                "extracted_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
                "extraction_policy": "Plain text files only; absolute, parent, hidden, backslash and unexpected-extension paths rejected. No remote code execution or symlinks.",
                "embedded_source_files": len(files), "configured_pages": len(config.get("pages", [])),
                "files": entries}
    (ROOT / "deployed-miniapp-source-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "DEPLOYED-MINIAPP-SOURCE.md").write_text("# 已部署浏览器原型源码（非完整微信工程）\n\n`deployed-miniapp-source/` 由线上原型运行时明确加载的公开 `source-bundle.json` 解出。59个原始文本文件保持原内容；`app.json` 由包内 `config` 对象序列化生成，原始文件格式不可恢复。未补造 `app.js`、微信开发者工具配置、后端或未随浏览器原型公开提供的文件。\n\n原始包保留于 `public-static/work.nong.cloud/miniapp-preview/source-bundle.json`；逐文件SHA-256和来源字段见 `deployed-miniapp-source-manifest.json`。图片及浏览器预览运行时保留于公开静态快照目录，不自动混入此源码目录。此目录用于审阅与比较实际部署原型，不能代表服务器全部源码或完整可发布微信工程。\n")
    print(json.dumps({"embedded_files": len(files), "extracted_files": len(entries), "configured_pages": len(config.get("pages", [])), "bytes": sum(x["bytes"] for x in entries), "bundle_sha256": manifest["bundle_sha256"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
