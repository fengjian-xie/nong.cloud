# 公开静态发布快照（非完整服务器备份）

本目录通过公开 HTTPS GET 保存 nong.cloud、m.nong.cloud、nc.nong.cloud、api.nong.cloud、work.nong.cloud 五站首页及明确引用的同域静态资源，并保存文档明确的工作台 `/miniapp-preview/` 浏览器原型。其运行时明确加载的 `/miniapp-preview/source-bundle.json` 保存了该原型公开提供的原生小程序源码。远程代码未执行。

**尚未完成服务器全部代码备份。** 本快照不包含原 8080 后端源码、旧 PHP 业务源码、服务器私有文件、数据库、生产环境配置、私密附件或凭据。线上编译 JS/CSS 不能替代原始 TypeScript/Java 源码。

请求限于明确引用的静态文件；所有带 query 的 URL 均拒绝，规范 URL 去重。业务 API、隐藏 Git、凭据端点及未明确引用的 source map 未访问。初次解析产生的重复临时文件已全部清理，本快照来自修正后的独立获取。

逐文件 URL、获取时间（UTC）、SHA-256、HTTP 状态和引用关系见 `public-static-manifest.json`。下载失败条目也在清单中保留。
