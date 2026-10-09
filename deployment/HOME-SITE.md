# nong.cloud 乡桥农事中心首页

## 内容与边界

独立品牌首页介绍四项业务：农事记录体系、产业服务协同、乡桥云农场、采购与库存共享。
列明平台主体「乡桥农业有限公司」和福安服务中心主体「福安市乡桥农事综合服务有限公司」。
20个工程样机、500亩试点、1000个用户及后续1000/10000张农事卡均为规划，不作为完成业绩。
自有记录核验体系不替代绿色食品等法定认证，不承诺保底收购价。
不向农户收平台服务费；农事记录卡办卡100元/张，补卡100元/张，卡片费用与平台服务费分开。消费者认购不收平台服务费，实际产品价款仍需支付。商业收入包括卡片销售、商家服务、采购信息、授权数据及合作社产品购销；其他商业服务收费另议。

全部生产照片使用本次用户指定的七张福安葡萄照片，不使用AI生成照片。
原图保持不变，网页副本压缩并清理EXIF/XMP/IPTC元数据。图片来源映射在 `admin-web/public/brand/ASSETS.md`。
照片展示不构成官方项目认定或人物代言；商用资料管理应保留版权、出镜授权。

## 本地与构建

```sh
cd admin-web
npm install
npm run dev -- --port 4174
# 本地预览 http://127.0.0.1:4174/home-preview
npm run lint
npm test
npm run build -- --mode home-site --base /brand-site/ --outDir /absolute/new/build-directory
```

home-site模式使用独立 `src/home/main.tsx` 入口，不加载后台组件、后台状态、管理菜单和样例视频。
普通开发入口保留API站点优先级及m站后台行为；首页使用按需加载组件。
API站点生产构建及原管理构建保持独立，不将本次官网包部署到这些站点。

## 部署隔离

仅在 `/etc/nginx/conf.d/nong.cloud.conf` 增加：

- 精确首页 `location = /`：使用 `/var/www/xiangqiao-home/current/index.html`，首页不缓存。
- 专用资源 `location ^~ /brand-site/`：仅返回独立发布资源；缺失资源返回404，不返回SPA页面。

原 `/api/v1/`、`/actuator/health`、其余旧路由、`/assets/` 与 `/var/www/nong.cloud` 不改动。
复用nong.cloud原证书，不创建新域名、不改DNS、不开放新端口。
其他Nginx配置、m.nong.cloud与api.nong.cloud的响应体、原站index和join.php均受保护校验。

发布脚本 `deploy_home_site.py` 默认仅首次安装；已存在受管目录时会拒绝重跑。
显式 `--update` 模式只接受已检查的受管目录、有效current链接和匹配的配置SHA256，不更改现有Nginx配置内容。
每次建立新版本目录、备份和清单，以原子链接切换上线；激活或就绪校验失败时恢复前一版本和原配置。
更新前必须检查当前配置、发布清单和备份，不能盲目覆盖旧网站。

macOS打包务必禁用附加元数据：

```sh
# package/dist为新的、已检查的首页构建副本
COPYFILE_DISABLE=1 tar --no-xattrs --exclude='._*' --exclude='*.md' -czf home.tar.gz -C package dist
shasum -a 256 home.tar.gz
python3 -m unittest discover -s deployment -p 'test*deploy*.py'
```

安全校验拒绝符号链接、父目录遍历、重复成员和非白名单目录；激活失败恢复原nong.cloud配置，保留失败版本与备份。
SSH私钥不进入代码仓库或上传包，本次临时授权在验收后撤销。

## 2026-10-04 发布结果

- 正式首页：https://nong.cloud/
- 发布版本：`/var/www/xiangqiao-home/releases/20261004T055400Z`
- 当前链接：`/var/www/xiangqiao-home/current`
- 配置备份：`/var/backups/xiangqiao-home/20261004T055400Z/nong.cloud.conf`
- 发布包SHA256：`c4b0fde5be9dc0b18e029b80ffb7b3e02914cd021f795ae2c3ce401ddaa1fce7`
- 新nong.cloud配置SHA256：`d835421d967c4eb219f2e9cf49da16e378d1cfde239eb4a9c4a69ea609d69981`

公网HTTP301到HTTPS，HTTPS200返回品牌首页；主页与葡萄图的服务器响应字节与发布文件一致。
缺失 `/brand-site/` 资源返回404；原nong.cloud API仍为未登录401，m.nong.cloud和api.nong.cloud首页仍为200且响应体未变。
其他Nginx配置、原站index和join.php校验保持一致。`nginx -t` 通过，原有端口80重复 `_` server_name警告未改动。

161项前端测试及17项部署测试通过。home-site与api-site构建、TypeScript检查及lint通过。
内置浏览器验证了品牌标题、非空内容、无错误覆盖层及线上控制台无相关错误；桌面1440×900首屏已截图。
本地390×844与1440×900验证业务切换、键盘切换、手机菜单、锚点与产区图片展开。线上浏览器交互验收存在连接超时，不能据此声称实际Safari/Chrome全版本均已测试。

首个macOS压缩包包含AppleDouble附加文件，被白名单校验拒绝，未修改线上配置。
失败发布目录保留在 `/var/www/xiangqiao-home.failed-20261004T054956Z`，备份位于 `/var/backups/xiangqiao-home/20261004T054956Z`。
禁用macOS附加元数据后重试成功。不得削弱压缩包安全校验以接受未知路径。

## 2026-10-04 五站入口更新（本节为当前版本）

按用户确认，首页品牌为「乡桥农事中心」，平台入口依次为
`nong.cloud`、`m.nong.cloud`、`nc.nong.cloud`、`api.nong.cloud`、`work.nong.cloud`。
农场与工作台入口已经启用。旧 `nongfu.tech` 不再作为生产页面入口；没有注销域名或删除DNS。
小程序「乡桥」的公开AppID为 `wx8e467f0ee6022a34`，已记录；本次没有登录微信平台配置、审核或发布。

- 当前版本：`/var/www/xiangqiao-home/releases/20261004T080421Z`。
- 前一版本：`/var/www/xiangqiao-home/releases/20261004T055400Z`。
- 更新备份：`/var/backups/xiangqiao-home/20261004T080421Z`。
- 发布包SHA256：`f63fae64e2167c16482f81376568a8973272ed2a89e8697cdbdfc73e0da94716`。
- nong.cloud配置SHA256仍为 `d835421d967c4eb219f2e9cf49da16e378d1cfde239eb4a9c4a69ea609d69981`。

178项前端测试、29项部署测试、lint和五种独立站构建通过。
用户允许的独立未登录Chrome完成线上五站交互验收；首页在1440、1024、768、390、320像素宽度无横向溢出。
五个入口地址、四项业务切换与键盘操作、移动菜单、公司介绍锚点、用户指定的七张照片加载均通过。
线上未出现相关控制台错误、错误遮罩或空白页。实际Safari尚未实机验证，不能宣称全版本兼容验收完成。
API生产接口仍返回明确JSON503；原nong.cloud API未登录响应仍为401。
农场、运营后台、主体工作台均为明确标注的交互演示，不是生产鉴权、真实摄像头或交易上线。

本次临时root SSH公钥行已撤销，其他授权保留，原authorized_keys内容恢复。
新SSH连接验证返回255/Permission denied；随后删除本地本次生成的私钥和公钥，并验证文件不存在。
保留线上发布版本与回滚备份。下次部署须重新取得已授权入口，不能复用本次临时密钥。

## 2026-10-04 农事卡、成员与标准准备稿（未发布）

新增本地组件：农事卡单排五键示意与四种应用场景、按提供表格整理的12条筹建成员资料、多身份申请资料清单、14类角色及12个环节的准入/执行/验收草案。
本地加入入口不上传个人资料、不表示已经受理；正式申请后台未接入。标准支持下载完整文本和空白验收模板，不是法定认证。
用户新提供的`图片3.png`用于农场介绍，原七张照片保留。新LOGO为桥拱、新芽与田垄的矢量提案，卡片图为研发示意。

用户最新要求先重新整理模块并输出，已形成`docs/乡桥平台模块方案-2026-10-04.md`，归并六大业务模块、统一底座与五端入口。本地业务概览暂仍保留原四个摘要标签；六模块方案未声称已经更新到线上。
本次没有上传或激活新的官网发布包，线上仍为`20261004T080421Z`。原配置和`/var/www/xiangqiao-api/join.php`指纹保持一致，其他四站配置未修改。

本次新临时密钥VVyugN已经精确撤销，authorized_keys恢复原内容，SHA256为`a5235dac82813937e4f52cb100c38005e9601bb8f12c1dff978ed721ea914676`。新连接验证为255/Permission denied；本地私钥和公钥已删除。后续发布不能复用该授权。

## 2026-10-05 收费口径与项目支持补充（本地，未发布）

收费统一为：不向农户收平台服务费；农事记录卡办卡100元/张、补卡100元/张。官网收费说明、卡片板块、加入申请清单、准入草案及本地工作台/后台相关文案同步，不再使用可能暗示免费领卡的“生产端免费”。
模块方案新增项目支持部分，另附`docs/乡桥项目补贴争取清单-2026-10-05.md`，区分当期政策、历史参考、已过窗口和待确认条件。项目管理为开发需求，未上线；没有代提交申请或修改政府系统。
本次未进行线上发布、DNS变更或SSH授权；线上版本仍以此前实际发布记录为准。
