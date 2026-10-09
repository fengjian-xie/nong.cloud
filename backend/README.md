# 乡桥本地 PostgreSQL 后端 V1

当前是可运行、已联调的核心业务版本，不是全部原型功能生产上线。完整接口与边界见 `../contracts/local-backend-v1.md`。

## 本机运行（本轮已完成）

本轮数据库：`127.0.0.1:55439/xiangqiao_local`；API：`127.0.0.1:8080/api/v1`；网页：`http://127.0.0.1:4199/`；小程序浏览器预览：`http://127.0.0.1:4201/`。数据实际存在PostgreSQL，不是H2内存替身。

本地配置在未跟踪的 `.env.local`（权限600）。测试账号为 `admin.local`、`farmer.local`、`provider.local`、`other.local`；密码取该文件的 `XQ_LOCAL_PASSWORD`。只有显式 `local` profile + `XQ_LOCAL_BOOTSTRAP=true` 才会创建测试数据；默认配置不会自动创建演示账号、角色或业务主体。不要将测试配置发布线上。

当前依赖工具安装在本机临时目录 `/private/tmp/xiangqiao-backend-tools.NwmfZZ`（未修改系统Java）。数据库数据目录是该目录的 `data/`；重启/系统清理临时目录后可能需要重新创建。没有导入生产数据库或真实用户资料。测试库仅监听loopback，以trust作为本机临时测试认证，不可用于服务器或共享环境。

启动当前测试库（若尚未运行）：

```bash
/private/tmp/xiangqiao-backend-tools.NwmfZZ/pg/bin/pg_ctl -D /private/tmp/xiangqiao-backend-tools.NwmfZZ/data -l /private/tmp/xiangqiao-backend-tools.NwmfZZ/postgres.log -o '-h 127.0.0.1 -p 55439 -k /private/tmp/xiangqiao-backend-tools.NwmfZZ' start
```

先停止正在使用的jar再重新构建，避免覆盖运行中的jar。安装标准Java21/Maven后：

```bash
cd backend
mvn package
bash run-local.sh
```

`run-local.sh`加载`.env.local`，只允许本机库、`xq_app`及local profile。Spring Boot不会自动读取普通.env文件；其他启动方式要自己导出环境变量。Flyway用`xq_migrator`做DDL，业务池用非超级用户`xq_app`。切勿让运行账号成为superuser。

## 可复现的新库

使用已安装的PostgreSQL16+，或 `compose.local.yml` 提供的可选官方容器（本轮未使用Docker验收）。启动前设置本地 `XQ_LOCAL_DB_PASSWORD`，端口只绑定127.0.0.1。Docker初始化postgres管理账号，仅用于建库；另建非超级用户迁移账号与运行账号。配置 `FLYWAY_DATABASE_USER=xq_migrator`、`DATABASE_USER=xq_app` 及对应密码。用postgres在新测试库执行：

```sql
CREATE ROLE xq_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '<本地迁移密码>';
ALTER DATABASE xiangqiao_local OWNER TO xq_migrator;
CREATE ROLE xq_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '<本地运行密码>';
GRANT USAGE ON SCHEMA public TO xq_app;
ALTER DEFAULT PRIVILEGES FOR ROLE xq_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO xq_app;
ALTER DEFAULT PRIVILEGES FOR ROLE xq_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO xq_app;
```

已有数据库还需显式GRANT现有表。生产应进一步按业务表缩减权限并隔离Flyway历史表、认证表等；本轮运行角色无superuser/建库/建角色权限，但仍是本地共享业务池，不是数据库RLS授权体系。

`tools/LocalDatabaseSetup.java`仅用于本轮全新的本机trust测试实例，一次性创建迁移/运行角色、测试库。再次执行会因为角色已存在而失败，不会重置已有库。`tools/LocalDatabaseCheck.java`只用于55439测试库，检查权限、迁移及标准/审计不可变约束，尝试修改后回滚。

## 网页与原生小程序

网页：

```bash
cd admin-web
VITE_DATA_MODE=backend npm run dev -- --port 4199 --strictPort
```

Vite将`/api/v1`代理到127.0.0.1:8080；原型模式默认保留，正式数据模式不读取mock或演示草稿。管理站和主体站共用已连接工作台，按服务端身份权限显示模块；不是将原有全部页面直接接上数据库。官网新闻、社交链接有公开API分支。云农场在backend模式明确显示尚未接入。

小程序预览：

```bash
XQ_PREVIEW_PORT=4201 XQ_PREVIEW_BACKEND=1 node miniapp/preview/server.cjs
```

登录页选择“本地数据库联调”。新增 `pages/connected/connected` 为真实API入口，原型继续独立。该浏览器预览不是微信SDK或真机；`wx.login`不会伪造code。微信开发者工具本地测试可使用loopback配置；真机需HTTPS合法域名、服务端凭据及openid绑定。配置位于 `miniapp/utils/connection.js`；非loopback禁用测试密码入口，不要提交真实密钥到小程序。微信openid只由服务端换取和绑定。

## 验证

```bash
# API服务先启动；密码使用本地测试配置，不要使用线上密码。
XQ_TEST_PASSWORD='<本地XQ_LOCAL_PASSWORD>' node --test --test-concurrency=1 backend/test/*.test.mjs
node --test miniapp/tests/*.test.cjs
cd admin-web
npm test
VITE_DATA_MODE=backend npm run build
```

自动化接口测试会写本地测试数据，限制目标为显式loopbackURL，不清空数据库；再次运行时主动选回原农服身份，避免已批准的新身份影响测试。单元/回归测试验证原型仍可用。

## 数据模型与已连接范围

| 领域 | 关系/约束 | 当前状态 |
|---|---|---|
| 账号、人员、中心、主体、身份、权限 | account→person；identity→account+center+subject+role；会话→当前identity | 已实现登录、切换、角色申请与下级中心创建/启停；自定义角色及动态岗位权限未接入 |
| 地块、记录 | center+subject复合外键；地块版本；actor+clientSeq唯一 | 创建、待审修改、管理员核验、手工记录已接通；定位测绘和附媒体变更待做 |
| 服务标准、需求、工单 | 不可改标准版本；request唯一order；行锁+If-Match | 接单→开工→提交→独立验收/争议已接通；V9增加发起人未接单取消；资质、证据附件、费用结算待做 |
| 帮助、消息 | 工单按identity隔离；消息按account+center；回复与消息同事务 | Web/小程序已互通；热线、坐席与回访待做 |
| 农事卡、申请、绑定历史、配置、事件 | 10000分报价；申请独立审批；绑定与生命周期版本；不可改历史 | 办卡/补卡申请→审核→云端绑定，挂失/恢复/停用，配置及采集记录查询已接通；实物/支付/BLE/NFC/验签待接 |
| 新闻、社交、审计 | 公开白名单字段；草稿不公开；追加型审计 | 已接通基础发布/撤回和配置；新闻独立审核未做 |
| 会员、批次、库存、采购交接 | 身份准入独立审批；方案不可改；库存约束、报价冻结 | V8已接入网页和小程序；免费会员可审批生效，收费会员待付款；V9增加本人申请撤回（不是退款） |
| 商户、分账计划 | 金额整数分；比例基点；接收方租户隔离 | V8管理后台已落库计算计划，不从农户扣平台服务费；真实资金执行返回503 |
| 产季、成本、摄像头、合同 | 仍与原型分离 | 未接通真实API，不返回模拟成功 |

V1旧表保留，不迁移原型localStorage。新领域使用39个`xq_`类型化表；V2–V9建立外键、范围校验、索引和不可变触发器。V8新增会员方案、申请、采购订单、交接证据及分账计划；V9只增加会员/服务需求取消证据字段及约束。既有卡片只有当前绑定快照，不补造首次实物绑定历史。生产数据不能从演示草稿自动导入。GPS/NFC信息不会自动成为合格证明，人工记录也不自动算人天。

本轮对齐：十类业务队列统一真实分页（含办卡/补卡申请），数据库列保持snake_case而JSON统一camelCase；日期、UTC时间、数字、null、布尔值有明确契约。卡片可读回云端ABC与三类历史，工单可读回验收说明，操作按钮由服务端availableActions控制；切换身份有预期身份头保护。字段测试使用`contracts/connected-data-v1.json`，不把旧原型模型当成数据库模型。

递归核对入口链：网页深链接→对应模块→权限→接口→查询/外键/状态→数据库回读；无权限的模块不默认回退到第一个模块。`/manage/production/cards`、`/manage/production/card-requests`、`/trade-orders`、`/manage/platform/centers`和`/manage/finance/settlement`分别对应自己的真实软件模块。小程序未知模块、农场或产季价值模块仍明确未接入；财务、商户、分账和中心管理不放入小程序。真实数据模式不会读取演示草稿或模拟HTTP返回。

全链路测试 `test/workflow-chain.test.mjs` 每轮创建独立qa账号与下级测试中心，不清空旧数据。覆盖准入、会员、办卡、农机服务、采购交接、8轮抢库存、争议冻结、分公司层级及分账计划。用 `XQ_QA_OUTPUT=/private/tmp/workflow-fixture.json` 可输出不含密码/令牌的测试对象信息，供浏览器回读验收。

浏览器回归（本机Mac，已有Chrome及Playwright WebKit依赖）：

```bash
XQ_TEST_PASSWORD='<本地测试密码>' node test/browser-compat.cjs
XQ_TEST_PASSWORD='<本地测试密码>' XQ_QA_FIXTURE=/private/tmp/workflow-fixture.json node test/browser-workflow.cjs
XQ_TEST_PASSWORD='<本地测试密码>' node test/browser-stakeholder.cjs
```

浏览器脚本只访问固定loopback入口；真实合同、微信支付与外部域名被拦截。WebKit26.5只代表引擎近似测试，不代表真实Safari/iOS/微信真机。截图写到自动创建的临时目录，不存密码/会话令牌。完整本轮结果见`../docs/local-workflow-qa-2026-10-08.md`。

六方审视新增`/work-guidance`：两端共读当前身份与权限对应的流程、费用说明和验收边界，不授予权限。指引失败不阻断业务列表。新测试`test/stakeholder-review.test.mjs`覆盖本人撤回、取消/接单竞争、取消留痕及不同身份的指引；`test/browser-stakeholder.cjs`测试网页与小程序双向撤回回读。业务意见和本轮范围见`../docs/乡桥六方视角审视与改进-2026-10-08.md`。

跨域：使用同源开发代理；需要直连的HTTP来源列入精确白名单，不开放*或null。工作台“连接诊断”可从浏览器真实检查跨端口健康接口。127.0.0.1与localhost的Cookie不共享；请使用本文统一的127.0.0.1地址。直接file预览显示HTTP入口提示。生产来源与外部SDK仍需实际环境验收。

## 上线前仍需完成

必须补全：其余原型模块的字段及路由适配、数据版本/证据附件、正式身份和管理员开通、动态中心角色、全国地址库、日志分页与全库搜索/地块选项搜索、会话清理/分布式限流/监控、异地备份恢复、TLS/Origin/反向代理、依赖安全升级、微信真机与外部设备/支付验收。当前Spring Boot3.5.4、临时PostgreSQL16.4仅作开发联调，不把通过测试视作生产安全验收。

支付服务商/特约商户号需在管理后台单独接入签名、验签、异步通知、退款、分账、回退和对账；前端不能标记付款成功。其他需要外部资料的功能保持未启用。本轮没有提交微信审核、没有执行真实合同/交易，也没有部署到阿里云。
