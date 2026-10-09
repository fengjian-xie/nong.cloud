# api.nong.cloud 独立开发者站点

状态：**2026-10-04 已上线独立API开放平台文档站与本地沙箱**，入口为[https://api.nong.cloud/](https://api.nong.cloud/)。业务网关与生产接口仍未实现，不能将前端演示理解为正式接口服务。

## 2026-10-04 实际发布记录

- 服务器：8.141.88.22，主机`iZ2ze1g23bw8f6jdqb0g95Z`，实例`i-2ze1g23bw8f6jdqb0g95`。沿用现有DNS，没有变更任何域名解析。
- 发布时间：2026-10-04 12:41:55（Asia/Shanghai，UTC发布标识`20261004T044155Z`）；随后完成外部HTTPS和浏览器验收。
- 当前发布：`/var/www/xiangqiao-api-portal/releases/20261004T044155Z`。
- 当前链接：`/var/www/xiangqiao-api-portal/current`。
- 专用配置：`/etc/nginx/conf.d/api.nong.cloud.conf`。其他Nginx `.conf` 的SHA-256与发布前快照一致。
- 备份：`/var/backups/xiangqiao-api-portal/20261004T044155Z`，含Nginx配置快照、`protected-sha256.json`及`deployment.json`。发布前没有API专用配置或`current`链接。
- 服务器上传目录：`/root/xiangqiao-api-deploy-20261004-iV5Itr`。
- 发现原`/var/www/xiangqiao-api/join.php`为既有业务文件，未改动其内容或目录权限；新文档站使用不同目录，未代理到该文件或8080服务。
- 专用证书：`/etc/letsencrypt/live/api.nong.cloud/fullchain.pem`，私钥仅保存在服务器；SAN为`api.nong.cloud`，当前到期日2027-01-02。外部与服务器本地HTTPS均使用正常证书校验，没有使用`-k`。
- 使用服务器已有Certbot账号与`certbot-renew.timer`（已启用）；认证方式为webroot，目录`/var/www/xiangqiao-api-portal/acme`。续期后执行`nginx -t`并热重载，参数已写入此域名的续期配置。
- 原有默认站点重复`_`名称警告在部署前已存在，本次未修改无关站点来处理该警告。

访问安全：网页终端恢复后，文件管理仍报告会话过期。用户明确批准了临时root SSH密钥。通过已登录终端核对ED25519主机指纹`SHA256:GlKlCtUyAvVyXzRHxLkXSj+HsBD5udOdItDLYK59ujQ`，全程严格主机校验；临时公钥带`restrict`选项。验收后只移除了本次公钥行，保留其他授权，并实际验证该密钥重新连接得到`Permission denied`。本地生成的临时私钥和公钥文件均已删除，未加入Git。

首次尝试在重载后立即读取HTTP验证目录时遇到404，自动撤回了新API配置与链接，尚未请求证书。检查文件路径、权限和systemd重载方式后，增加异步重载的就绪检测重试，第二次成功发布。首次产物保留在`/var/www/xiangqiao-api-portal.failed-20261004T043813Z`，诊断备份保留在`/var/backups/xiangqiao-api-portal/20261004T043813Z`；未删除既有站点资料。

使用的发布包（已上传，服务器与本地SHA-256一致）：

- 本地文件：`/Users/xiexiansheng/.codex/visualizations/2026/09/07/01a07b34-f4a9-7802-a6a5-72c87b599a13/api-open-platform/release-zprlG2/api-site-release.tar.gz`
- SHA-256：`20aed3ad0b2a2c03a19e7ad78543c52dbf3b1f5837645df777b7881ab998055f`
- 包含`dist/`、说明和模板的打包时快照；本次只提取`dist/`到站点目录，另外上传并应用仓库中的最新模板。不要直接使用压缩包里的旧路径模板，以本文件和实际部署记录为准。
- 专用`api-site`构建已验证，原有站点构建、lint和156项前端测试在打包前通过；本次另有7项部署安全测试通过。

## 路由与隔离

- 目标入口：`https://api.nong.cloud/`，根路径直接显示开放平台，不进入管理员登录、后台侧栏或角色工作台。
- 本地预览：`http://127.0.0.1:4174/api-portal`。
- `api.nong.cloud` 精确主机匹配后加载独立站点；其他主机的现有管理后台逻辑不变。独立入口不挂载后台AuthProvider或FarmProvider。
- 后台保留 `/open-api` 管理演示页面；页面的「独立API站点」按钮在本地跳转 `/api-portal`，非本地主机跳转目标域名。
- 未来接口Base：`https://api.nong.cloud/open-api/v1`。这是规划地址，不是已实现接口。
- 当前调试在浏览器本地执行，cURL仍使用 `.invalid` 占位地址；演示钥串、配额和审批均不是真实身份/商业权限。

## 后续更新注意事项

1. 先检查当前链接与配置并备份，再创建新的版本化目录；不要覆盖当前发布目录，不要复制其他域名的证书。
2. `deploy_api_site.py`是本次首次独立部署的安装器，会拒绝已有API目录/配置。后续更新需按实际链接制定更新方案，不能盲目重跑。
3. 不要重跑旧`deploy.py`，它只针对旧m.nong.cloud布局且会拒绝已有托管发布。
4. 私钥、密码与新的SSH授权均不属于前端包；下一次服务器访问需使用用户已授权的入口，不能假设本次临时密钥仍有效。
5. 如需退回发布前无独立API站点的状态，只停用API专用配置并验证后热重载；保留发布目录用于恢复。不要用全局备份覆盖其他正在运行的站点。

## 发布准备

前端在`admin-web`使用 `npm run build -- --mode api-site --base /` 构建独立发布包。该模式生成API站点专用HTML标题与描述，并强制独立站点入口（即使通过服务器IP访问也不进入管理后台）。API站点使用根资产路径`/assets/`；不要复用现有m站点的`/fuan-ui/assets/`基址。普通`npm run build`仍生成原管理站点包。文档站无需新增业务后端，但真实开放API仍需单独开发网关、鉴权、审批和审计。

`api.nong.cloud.http.conf.example`仅用于首次签发证书时的HTTP-01验证；成功后由`api.nong.cloud.nginx.conf.example`替换，使用`/var/www/xiangqiao-api-portal/current`和专用证书。安装器先验证压缩包SHA-256和档案路径、备份配置、检查Nginx，再热重载并等待站点就绪；失败只回退API专用改动，保留发布和备份文件供诊断。

证书认证采用[Certbot官方webroot方案](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot)，没有停止共享Nginx或使用自动改写其他虚拟主机的安装器。

模板对`/api`与`/open-api`前缀返回JSON 503，防止未部署接口被误认为可用或落到SPA HTML。未来真实网关就绪后才将对应路径改为明确的网关上游，不能盲目转发到现有8080服务。

## 正式发布验收

- HTTPS首页：200，标题`乡桥API开放平台 · api.nong.cloud`，没有管理员导航；HTTP入口301到HTTPS。
- 入口JS：`index-CA7oeFnr.js`，SHA-256 `aa7cd834d106893bea349acd4953ee58c18c354df1df299890446ab7dbd27a42`，外部响应与本地构建相同。
- 入口CSS：`index-Cd-t3CNz.css`，SHA-256 `9165e0469e8815e20d218de782cddf471cb9273512fba48dd434bdbaf53c8a3b`，外部响应与本地构建相同。
- 规划接口`/open-api/v1/maturity-listings`：503、`application/json`、错误码`XQ-OPEN-503-001`，明确说明尚未部署，而非SPA HTML或旧服务数据。
- 未知`/assets/does-not-exist.js`：404。
- 应用内浏览器：实际线上首页完整渲染，无空白、框架错误遮罩或相关warn/error日志；点击「接口目录」后显示8个草案及参数说明；访问`/login`自动返回独立首页，没有管理员登录页。
- 原`m.nong.cloud`和`nong.cloud`：HTTPS均为200，首页长度、Last-Modified及ETag与发布前相同。没有测试其已认证业务，也没有改动其前后端。
- 本次未单独运行Safari、移动设备、支付、真实设备或生产API流程；之前本地移动布局验证不替代这些线上测试。
- 线上截图：`/Users/xiexiansheng/.codex/visualizations/2026/09/07/01a07b34-f4a9-7802-a6a5-72c87b599a13/api-open-platform/live-api-site.jpg`。

独立站点在不同浏览器Origin，演示应用元数据不会自动从m.nong.cloud迁移；正式应用管理应连接后台网关，由服务端统一保存和鉴权。

## 2026-10-04 统一品牌更新（当前版本）

本次仅更新文档站前端，标题保持「乡桥API开放平台 · api.nong.cloud」。
站头回到「乡桥农事中心」nong.cloud；开放平台标识使用 `API.NONG.CLOUD`，不再使用旧域名品牌。

- 当前版本：`/var/www/xiangqiao-api-portal/releases/20261004T080208Z`。
- 前一版本：`/var/www/xiangqiao-api-portal/releases/20261004T044155Z`。
- 备份：`/var/backups/xiangqiao-api-portal/20261004T080208Z`。
- 发布包SHA256：`27428a378b4f5202ad813a37d73ade7c5442d8bcbc1a0e2246aabd47996fb67c`。
- 配置SHA256：`4d1cfef3f915d835fac6a439e2aec0fd2067a82a9b98aa07a0579e26731d288d`，本次未修改配置或证书。

使用 `update_api_portal.py` 校验本站受管链接、配置哈希和接口503基线后原子切换发布。
独立未登录Chrome线上验收：接口目录搜索与空结果恢复、本地沙箱响应与日志、桌面/移动布局均通过，无相关控制台错误。
测试没有向服务器发送POST；`/open-api/v1/plots`仍为JSON503，不是真实开放接口。
旧首次安装器不能用于已上线站点；后续更新须重新检查最新配置及链接，再执行受控更新。
