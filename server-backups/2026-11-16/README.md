# 阿里云公开发布代码快照（部分备份）

保存日期：2026-11-16（北京时间）。本目录从 nong.cloud、m.nong.cloud、nc.nong.cloud、api.nong.cloud、work.nong.cloud 的公开 HTTPS 页面保存线上实际发布内容。

## 已保存

- 87 个公开静态文件，合计 8,532,577 字节，包括五站 HTML、JavaScript、CSS、明确引用的图片及小程序浏览器原型。
- 小程序原型公开加载的 `source-bundle.json`；另按原包安全解出 59 个原始 JS/WXML/WXSS/JSON 文件，并由原包 config 生成 `app.json`。
- 来源 URL、获取时间、HTTP 状态、引用关系、逐文件 SHA-256 和复现脚本。

详细范围见 [公开静态快照说明](PUBLIC-STATIC-SNAPSHOT.md) 和 [原型源码说明](DEPLOYED-MINIAPP-SOURCE.md)。两个 manifest 可用于核验保存的原始字节。

## 完整性边界

**这不是完整服务器备份。** 没有通过服务器文件系统读取原 8080 后端源码、旧 PHP 业务源码、私有文件或生产配置。数据库、私密附件及凭据不在此公开仓库快照中。编译 JS/CSS 不能替代原始 TypeScript/Java 源码；解出的小程序文件也仅代表公开浏览器原型，并非完整微信发布工程。

本分支以现有 GitHub main 为父提交，保留仓库已有的开发源码；新增快照位于独立 `server-backups/2026-11-16/` 目录。要确认阿里云上所有代码均已备份，仍需获取服务器文件系统访问并补齐上述缺失范围。
