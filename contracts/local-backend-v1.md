# 已实现接口：本地数据库联调 V1

本文件描述实际运行的 Java 控制器，不把原型沙箱或规划接口视为已实现。旧 `api-v1.md` 保留作历史一期契约。基础地址 `/api/v1`；本地 `http://127.0.0.1:8080/api/v1`。本轮未发布到 `api.nong.cloud`。

## 共用协议

响应：`{code:0,message:"OK",data,traceId,timestamp}`。失败同时返回 HTTP 状态及 `errorCode`，不泄露 SQL、密码、密钥、堆栈。地块、农事记录、服务需求、工单、农事卡、办卡补卡申请、帮助工单、消息、身份申请、管理新闻均为真实分页：`{items,total,page,size,hasNext}`；`page=1–100000`，`size=1–100`（默认20），非法参数422。`total` 是当前身份有权访问的总数，数量与当前页在一个只读快照中计算，排序用唯一id打破同时间并列。翻页之间新增数据可能改变位置，批量导出应另做游标接口。

公共新闻返回数组，最多20条；角色、标准、社交配置和审计返回数组，审计暂限最近100条。两端业务下拉地块暂取前100条，不代表全部地块。完整可执行字段契约见 `connected-data-v1.json`。数据库列使用snake_case，接口统一camelCase；面积为JSON数字，时间戳为UTC ISO字符串，计划日期为YYYY-MM-DD，未填写字段为null（不自动补0或空字符串）。所有日期规范化也用于幂等回放。

十进制输入按原始精度校验，不先转成浮点数再取整；金额仍为整数分，库存数量最多3位小数，面积最多4位小数。农事及设备事件的`occurredAt`最多支持微秒（6位有效小数）；无法精确落库的更高精度返回422，不静默舍入，以免同一事件重试后产生冲突。上级中心停用时，所有下级中心的公开新闻与社交配置也停止展示，恢复上级后恢复可见。

网页使用 HttpOnly 会话 Cookie；`credentials:include`，写请求附 `X-XQ-Client:web-v1`，服务端核验准确的 Origin。小程序使用 `Authorization:Bearer <opaque token>`；令牌只以 SHA-256 摘要存在数据库，不是可改角色的 JWT。

两端业务读写还携带 `X-XQ-Identity:<页面确认的身份id>`。服务端会话身份已改变时409 / `XQ-IDENTITY-409`，不执行写入；客户端应刷新`/users/me`并重新确认，不自动重试旧表单。该头不是授权依据，省略也不能绕过会话权限；旧调用者暂兼容。身份切换、获取me及退出不受此预期身份头限制。

除登录、退出和身份切换外，所有业务写请求附 `Idempotency-Key`（8–128字符，仅字母、数字、`_.:-`）。同一账号+身份+键+请求内容可重试，同键改变路径、正文或版本返回409；事务失败不会保留成功回执。接口正文重试必须保持一致，农事记录保留原 `clientSeq/occurredAt`。

涉及版本的操作附 `If-Match:<version>`；缺失428，过期409。卡片设置使用 `desiredConfigVersion`，其余使用行 `version`。

错误码：400格式错误；401未登录/会话失效；403无权限/Origin违规；404当前身份不可见或接口不存在；409版本、状态、唯一性冲突；422字段不合法/缺幂等键；428缺版本；429登录限流；503微信凭据缺失或微信服务不可用。

客户端的 `centerId/subjectId/status/source/permissions` 不授予访问权。运行中心、业务主体、身份、角色权限由会话关联得出；账号可以切换不同中心/主体的已批准身份，但请求只在当前身份范围生效。

## 认证、身份与配置

| 方法与路径 | 正文/结果 | 约束 |
|---|---|---|
| GET `/health` | database/status/paymentsEnabled/hardwareVerified | 真正查询 PostgreSQL；支付/设备验签为false |
| POST `/auth/password/login` | username,password → user,identities,activeIdentityId,permissions,token,expiresAt | BCrypt密码；12小时会话；无固定短信验证码 |
| POST `/auth/wechat/login` | code → 同上 | 服务端AppID/Secret、openid账号绑定须先配置；不自动注册/授予身份 |
| GET `/users/me` | user,identities,activeIdentityId,permissions | 身份含id/role/label/org/centerId/subjectId/centerName |
| POST `/identities/{id}/switch` | 空JSON → me | 必须属于本人，且已批准、中心启用 |
| POST `/auth/logout` | 空JSON → loggedOut | 删除服务端会话、过期Cookie |
| GET `/tenants/current/config` | center,permissions,features | 不是客户端选择tenant的接口 |
| GET `/role-catalog` | id,name数组 | 当前内置12种业务身份；不包含管理岗位 |

## 地块和手工农事记录

| 方法与路径 | 正文/主要字段 | 权限/版本 |
|---|---|---|
| GET `/plots?page=1&size=20` | id,name,areaMu,crop,address,latitude,longitude,status,version,subjectId | plots.read；size最多100 |
| GET `/plots/{id}` | 与列表同一字段集合 | 同中心/主体；统一centerId/subjectId及createdAt/updatedAt |
| POST `/plots` | name,areaMu,crop,address；管理员另选subjectId | plots.write；初态pending；areaMu>0，最多4位小数 |
| PATCH `/plots/{id}` | name,areaMu,crop,address | plots.write + If-Match；仅pending可改 |
| POST `/admin/plots/{id}/verify` | approved:boolean | plots.verify + If-Match；pending→verified/rejected |
| GET `/farm-activities` | id,plotId,plotName,operation,occurredAt,source,note | records.read；按地块归属隔离 |
| POST `/farm-activities` | plotId,operation,occurredAt（ISO UTC）,clientSeq,note | records.write；服务器强制source=manual；actor+clientSeq唯一 |

正式地块不直接覆盖种植产品；照片/视频上传、变更申请、独立审核、产季版本仍未接通。现在返回409以阻止静默修改，而不是假装已处理变更。数据库中原始记录为追加型证据。

## 服务需求与工单

| 方法与路径 | 正文/结果 | 权限/状态 |
|---|---|---|
| GET `/service-standards` | id,operation,revision,criteria（文本字符串）数组 | 当前中心已发布不可改版本 |
| GET `/service-requests` | id,operation,plotId,plotName,scheduledDate,standardText,status,version | 种植身份看本主体；农服看本中心open需求；管理员看中心 |
| POST `/service-requests` | plotId,standardId,scheduledDate（YYYY-MM-DD） | services.request；仅verified地块；作业及标准由server复制，忽略伪造文本 |
| POST `/service-requests/{id}/claim` | 空JSON → 工单id/requestId/status/version | services.claim + If-Match；锁需求行；同一需求只有一个工单；本人不能接自己的需求 |
| GET `/work-orders` | id,requestId,operation,plotId,plotName,scheduledDate,standardText,status,version,completionNote,acceptanceNote,availableActions | 当前种植主体/服务主体；管理员仅当前中心 |
| POST `/work-orders/{id}/check-in` | 空JSON | 接单人账号+主体；claimed→working |
| POST `/work-orders/{id}/submit` | note | 接单人账号+主体；working→submitted |
| POST `/work-orders/{id}/accept` | note | 种植主体；submitted→accepted；同person不能自验收 |
| POST `/work-orders/{id}/dispute` | note | 种植主体；submitted→disputed |

工单动作均需If-Match。服务标准冻结在需求内，不跟随后来配置变化。`qualityCertified:false`：流程验收不等于质量合格认证。尚无材料资质核验、服务证据附件、争议调解、计价、退款或结算。

需求与工单列表的`availableActions`由服务端按身份、操作人及状态计算，客户端只显示允许的按钮；写接口再次核验，不信任客户端按钮状态。不把内部person/provider账号字段暴露给列表。验收说明和完工说明均能跨端读回。

## 帮助、消息、身份申请

| 方法与路径 | 正文 | 约束 |
|---|---|---|
| GET `/help-tickets` | category,description,status,reply,version等 | 用户只看本账号当前身份；help.manage看当前中心 |
| POST `/help-tickets` | category,description | help.create；真正落库 |
| POST `/help-tickets/{id}/reply` | reply,status（processing/resolved） | help.manage + If-Match；同事务生成用户消息；resolved表示已回复，不自动代表用户确认解决 |
| GET `/messages` | id,title,body,category,read,createdAt | 本账号当前中心（同账号身份共享消息） |
| POST `/messages/{id}/read` | 空JSON | 本账号可见消息；不替其他账号标读 |
| GET `/identity-applications` | role,subjectName,address,reason,status,version等 | 本账号；identities.manage看中心 |
| POST `/identity-applications` | role,subjectName,address,reason | 只入pending，不提权；不能申请管理员岗位 |
| POST `/admin/identity-applications/{id}/review` | approved:boolean | identities.manage + If-Match；本人不能审本人；批准后新建主体与身份 |

审核当前是中心业务身份绑定，不替代农药经营、检测等法定资质核验。家庭代办授权范围及期限未实现，family不会继承种植户的数据访问权。客服电话、通话录音、回访调度未接入。

## 农事卡

| 方法与路径 | 正文/结果 | 约束 |
|---|---|---|
| GET `/cards` | id,status,bindingVersion,desiredConfigVersion,acknowledgedConfigVersion,configuration,deviceConfirmed | cards.read + 当前主体/中心；configuration为A/B/C对象 |
| GET `/cards/{id}/configuration` | id,configuration,desiredConfigVersion,acknowledgedConfigVersion,deviceConfirmed | cards.read + 当前主体/中心；只读云端配置 |
| PUT `/cards/{id}/configuration` | A,B,C（各1–80字） | cards.configure + If-Match=desiredConfigVersion；保留历史，deviceConfirmed=false |
| POST `/cards/{id}/events` | events[1–100] | 同一事务落库，成功后才返回persisted=true；未做硬件身份认证 |

事件：`eventId,bindingVersion,configVersion,button(start/stop/A/B/C),occurredAt,fixStatus(fixed/failed/pending),latitude?,longitude?`。当前绑定版本必须匹配；配置必须存在，不能用当前配置覆盖旧记录。坐标成对、范围有效、最多7位小数；fixed必须有坐标；时间不得超前5分钟。同card+eventId内容一致去重，内容不一致409；批次任何一条不合法时全部回滚。

回执：`{cardId,hardwareAuthenticated:false,receipts:[{eventId,persisted:true,duplicate,verificationStatus:"unverified"}]}`。这里只接有cards.upload或cards.manage权限的授权账号上传的未验证证据，不把普通JSON冒充硬件签名记录，不自动推断GPS属于某地块，不生成“作业已完成”。真实蓝牙/NFC、固件回执、实物交付和支付待接入；云端卡管理见下节。

### 卡片软件生命周期（V7）

| 方法与路径 | 正文/结果 | 服务端约束 |
|---|---|---|
| GET `/card-requests` | id,kind,oldCardId,newCardId,reason,feeFen,status,reviewNote,version,createdAt,availableActions,paymentStatus,physicalDeliveryConfirmed | cards.request看本账号当前身份；cards.manage看本中心；真实分页 |
| POST `/card-requests` | kind(issue/replacement),reason,oldCardId（仅补卡） | cards.request；所属主体由会话决定；10000分报价不接受客户端覆盖；pending |
| POST `/card-requests/{id}/cancel` | 空JSON | 原申请账号+身份；pending/approved→cancelled；If-Match |
| POST `/admin/card-requests/{id}/review` | approved:boolean,reviewNote | cards.manage，不能审核同person自己的申请；pending→approved/rejected；If-Match |
| POST `/admin/card-requests/{id}/register` | 空JSON → newCardId等 | cards.manage，已approved且非本人申请；事务创建软件卡、配置V1、绑定历史和申请状态cloud_registered；If-Match |
| POST `/cards/{id}/lifecycle/report-loss` | reason | cards.loss当前主体，或cards.manage本中心；active→lost；If-Match=卡片version |
| POST `/cards/{id}/lifecycle/restore` | reason | cards.manage；lost→active；存在进行中补卡申请则409 |
| POST `/cards/{id}/lifecycle/retire` | reason | cards.manage；active/lost→retired；已retired或存在进行中补卡申请则409 |
| GET `/cards/{id}/binding-history` | id,bindingVersion,status,action,reason,createdAt | cards.read，同主体/中心；分页；历史追加不可覆盖 |
| GET `/cards/{id}/configuration-history` | id,version,configuration:{A,B,C},createdAt | cards.read，同主体/中心；分页 |
| GET `/cards/{id}/events` | id,eventId,bindingVersion,configVersion,button,operation,occurredAt,receivedAt,fixStatus,latitude,longitude,verificationStatus,hardwareAuthenticated | cards.read，同主体/中心；分页；operation按事件对应旧配置解释，非当前ABC |

新登记卡`softwareOnly=true`，device_uuid内部用software命名空间，不冒充已识别硬件；不允许通过此流程向其他主体重新绑定既有卡，以免泄露历史记录。既有卡hardwareAuthenticated也仍为false。办卡与补卡均`feeFen=10000`（100元），`paymentStatus=not_connected`、`physicalDeliveryConfirmed=false`、`deviceConfirmed=false`；审批和软件登记不能改变这三种外部状态。未来实物交付/收费上线须独立接入验收。

补卡先挂失原卡；同原卡最多一个pending/approved申请。登记新卡时冻结原主体，复制其云端ABC作为新卡V1，原卡retired，原卡事件、配置和绑定历史完整保留。挂失/恢复/停用均推进bindingVersion与独立卡片version，并清零设备确认；过期绑定上传409，lost/retired卡不可入库新事件。恢复不代替设备重新同步。

卡片列表新增`version,softwareOnly,availableActions,hardwareAuthenticated`。ABC写入仍使用desiredConfigVersion，生命周期写入使用version，两者不能混用。后台负责审核/登记/恢复/停用；用户端负责申请、取消、挂失与查询，管理财务不放入小程序。

## 内容及管理

| 方法与路径 | 正文/结果 | 约束 |
|---|---|---|
| GET/POST `/admin/news` | POST title,body → draft | news.manage；正文纯文本，不执行HTML |
| POST `/admin/news/{id}/publish` | 空JSON | news.manage + If-Match |
| POST `/admin/news/{id}/withdraw` | 空JSON | news.manage + If-Match |
| GET `/public/news?center=local-fuan` | id,title,body,publishedAt,centerName | 仅已发布+中心active，白名单公开字段 |
| GET `/admin/social-accounts` | channel,displayName,url,enabled | news.manage |
| PUT `/admin/social-accounts/{channel}` | displayName,url,enabled | news.manage；对应平台HTTPS白名单 |
| GET `/public/site-config?center=local-fuan` | channel,displayName,url | 仅启用账号和active中心 |
| GET `/admin/subjects` | id,name,kind | center.manage；本中心 |
| GET `/admin/audit-logs` | id,actorId,action,traceId,createdAt | audit.read；只读成功业务写入日志，不含会话令牌 |

尚未实现新闻独立编辑审核链、产区自定义角色、管理员权限配置、第三方同步及异常访问日志持久化。V8已实现下级中心创建与启停，不开放中心删除或修改上级关系。本轮RBAC使用已初始化的固定权限映射，不允许客户端自定义权限。

核验、身份审批的`approved`和社交配置的`enabled`必须是JSON布尔值，字符串`"true"`、空值或遗漏返回422，不会默默视作false而驳回或停用。

## 跨域与开发代理

本机网页使用相对`/api/v1`经Vite代理；小程序HTTP预览经固定loopback代理。不要从`file://`打开预览：其来源为null、资源加载也不符合HTTP服务约定，程序显示HTTP入口提示而不放宽后端。

`XQ_ALLOWED_ORIGINS`为精确的`协议://主机:端口`逗号分隔列表（会去除外围空格），不能含路径、尾部斜杠、通配符或null。本地配置明确列出127.0.0.1/localhost的4199、4201、4193；新增端口需要改本地配置并重启后端。cookie不跨localhost和127.0.0.1共享，日常联调统一使用127.0.0.1。

后端默认是六个HTTPS官网/业务来源；本地`.env.local`显式覆盖。CORS允许凭据、业务方法与两端使用的明确请求头，公开追踪响应头`X-Request-Id`；OPTIONS预检无须登录，非法来源/方法/头仍403，允许来源上的401/409错误也保留CORS响应头。跨域策略不代替登录与CSRF校验。

工作台“连接诊断”提供只读本地跨域健康检查：真实发起4199→8080的凭据预检与读取，不使用后台HTTP结果冒充浏览器通过。生产尚需HTTPS、正确反代与来源配置；`xiangqiao.ltd`与`nong.cloud`是不同站点，企业官网可匿名读公开信息，不能据此假设跨站Cookie登录自动通用。

## 不存在的接口

库存锁定及双方采购交接已在V8实现（见下节）；冷库保管与货权转让、产季成本、成熟预测、认购合同、真实摄像头、一品一码同步、土壤检测、补贴申报及真实支付/分账执行仍未接通。不要将旧沙箱示例接到生产交易。

## V8 全链路软件扩展（local-v1.3）

数据库现为39张`xq_`表。新增字段的可执行契约位于`connected-data-v1.json.workflowLists`。新分页队列为会员方案、会员申请、库存批次、采购订单、分账计算计划；中心与商户配置暂返回数组。请求与响应遵守上文同一协议，金额整数分、数量JSON数字（千克，最多3位小数）、时间UTC、空值null。

| 接口 | 行为与边界 |
|---|---|
| POST `/auth/local-register` | **仅local profile + 本地bootstrap + loopback**。用户名qa前缀、密码至少12字。创建消费者基础身份，忽略客户端角色字段；不用于生产注册或微信授权。 |
| GET `/membership-plans`；POST `/admin/membership-plans` | 管理员发布不可改方案；业务账号只看当前角色方案。feeFen=0–99900，validDays=1–3660；farmer/cooperative必须免费。 |
| GET/POST `/memberships`；POST `/admin/memberships/{id}/review` | 身份须先批准；本人不能自审会员。免费方案审批后active；收费方案只到awaiting_payment，expiresAt=null。不可用客户端paid字段激活。当前身份有效会员或未决申请不可重复。 |
| GET/POST `/admin/centers`；POST `/admin/centers/{id}/status` | 只能创建当前中心的直接下级；绑定创建管理员的新中心身份。中心列表递归覆盖自己的子树，不包含其他根中心。停用祖先即禁止下级会话；恢复不覆写后代本身启停状态。不是工商设立或生产运维开通。 |
| POST `/admin/service-standards` | 发布新标准版本；不覆盖旧标准，工单继续使用已冻结标准。 |
| GET/POST `/stock-batches` | 种植主体仅能发布本主体已核验地块的批次；product来自地块。管理员看本中心，采购商须当前身份有效会员。reservedKg+soldKg不超过quantityKg。 |
| GET/POST `/trade-orders` | 买方按服务端批次报价锁库存；If-Match使用批次version。数量×单价以HALF_UP转整数分；报价、金额、中心不可由客户端覆盖。本人不同身份不能向自己采购。 |
| POST `/trade-orders/{id}/{seller-confirm\|dispatch\|accept\|dispute\|cancel}` | 订单If-Match。卖方确认、登记发货后，买方独立验收。accept将锁库存转已售；发货前cancel精确释放锁库存。争议保持库存锁定，调解/退款另待实现。验收不代表付款、运输实测或质量认证。 |
| GET `/trade-orders/{id}/handovers` | 双方及当前中心管理员有权只读；交接证据不可修改/删除。网页、小程序可查看相同记录。 |
| GET/POST `/admin/merchants` | 财务权限，配置当前中心商户号；祖先接收对象可读。pending及externalVerified=false；不是微信侧核验。小程序无财务入口。 |
| GET/POST `/admin/settlement-plans` | 仅已验收采购单可生成唯一、不可改计算计划。merchantServiceFeeFen为**商户侧服务收入计划**，不是从农户货款扣取；不得超过参考订单金额。platformRateBps由管理员明确设置（100基点=1%）。总部份额向下取整，余数归中心；两者精确等于分账池。sourceAmountFen保留原订单额，producerServiceFeeFen=0。 |
| POST `/admin/settlement-plans/{id}/execute` | 当前为503/XQ-PAYMENT-503；不会生成成功分账或真实付款记录。比例0–10000仅用于软件计算，**不代表微信许可的最大分账比例**。 |

身份列表默认优先已批准业务身份、消费者基础身份靠后；同级管理身份优先根中心。用户仍可自行切换已批准身份，不能通过默认选择扩大权限。

并发：幂等记录的身份外键先取得KEY SHARE。会员/采购串行核对使用FOR NO KEY UPDATE，避免升级FOR UPDATE造成外键锁死锁。库存、需求、订单仍有独立行锁、版本检查和事务审计；锁失败/超时返回409且事务回滚，不把失败写成已完成。

真实微信支付需要另外接入官方签名、通知验签、已支付交易、接收关系授权、可分账余额/比例、异步结果、退款回退与对账。参考[服务商请求分账](https://pay.wechatpay.cn/doc/v3/partner/4012690683)及[开发接入准备](https://pay.wechatpay.cn/doc/v3/partner/4012072589)。这里的数据库计划不是支付沙箱或支付成功凭证。

## V9 角色指引与撤回证据（local-v1.4）

V9不改历史迁移，表数仍39。会员及服务需求增加cancellation_note/cancelled_at/cancelled_by；接口分别返回可空`cancellationNote`和`cancelledAt`，不暴露取消人原始数据库列。新取消记录数据库强制保留非空原因、时间和操作者；已有历史记录不回填伪造证据。

| 接口 | 行为与边界 |
|---|---|
| GET `/work-guidance` | 已登录、当前身份限定。返回stakeholder-v1版本、identityId、role、title、steps、checks、fees、limits。steps只包含已有权限对应的流程，不授予权限；fees的feeFen为整数分，种植户平台0、卡报价10000，不表示收款。政府授权及农资台账明确未接通。 |
| POST `/memberships/{id}/cancel` | membership.apply权限、本人账号/当前身份/当前中心、If-Match及幂等键；仅pending/awaiting_payment→cancelled。保留审核说明和原费用，另存取消原因（body.note，非空最多2000字）、时间及操作者。refundExecuted=false；可重新申请，不取消已生效会员。 |
| POST `/service-requests/{id}/cancel` | services.request权限、自己发起且当前主体/中心范围、If-Match及幂等键；仅open→cancelled。body.note非空；与claim竞争同一需求锁。已接单不允许直接取消。workOrderCancelled=false，不会删除或撤销已接单工单。 |

列表availableActions只在服务端允许时增加cancel；客户端不得仅凭pending/open状态显示取消按钮。取消操作写审计，重试原幂等键返回同一结果；缺版本428、越权403/范围内不存在404、版本/状态竞争409。取消原因及时间两端重新查询后可读，未取消字段为null。

两端均标明库存/等级为卖方自报，检测与货权证明未实接。指引格式或身份不符时不展示，失败独立降级，不影响已持久化业务列表。收费会员撤回不是退款；客服回复不是争议调解完成。
