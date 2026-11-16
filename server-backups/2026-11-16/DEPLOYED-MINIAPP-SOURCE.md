# 已部署浏览器原型源码（非完整微信工程）

`deployed-miniapp-source/` 由线上原型运行时明确加载的公开 `source-bundle.json` 解出。59个原始文本文件保持原内容；`app.json` 由包内 `config` 对象序列化生成，原始文件格式不可恢复。未补造 `app.js`、微信开发者工具配置、后端或未随浏览器原型公开提供的文件。

原始包保留于 `public-static/work.nong.cloud/miniapp-preview/source-bundle.json`；逐文件SHA-256和来源字段见 `deployed-miniapp-source-manifest.json`。图片及浏览器预览运行时保留于公开静态快照目录，不自动混入此源码目录。此目录用于审阅与比较实际部署原型，不能代表服务器全部源码或完整可发布微信工程。
