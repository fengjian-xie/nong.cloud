# `/api/v1` 一期契约基线

## 统一响应信封

```json
{
  "code": 0,
  "message": "OK",
  "data": {},
  "traceId": "mock-fuan-000001",
  "timestamp": "2026-08-29T08:00:00Z"
}
```

失败时 `code` 非 0，`errorCode` 为 `XQ-<domain>-<http>-<sequence>`，`data` 通常为 `null`。

## 公共约束

- 登录接口外均使用 `Authorization: Bearer <token>`。
- 租户由受信令牌解析，只允许 `tenantCode=fuan`、`countyCode=350981`；前端不发送 `tenantId` 选择数据源。
- 写操作使用 `Idempotency-Key`，离线同步使用 `clientSeq`。
- 分页统一为 `{items,total,page,size,hasNext}`，页码从 1 开始。
- 请求可携带 `X-Request-Id`，响应必须返回 `traceId`。

## 一期接口

### 公共与认证

- `POST /auth/sms/login`
- `POST /auth/wechat/login`
- `GET /users/me`
- `GET /tenants/current/config`

### 运营后台

- `GET /metrics/dashboard`
- `GET /admin/tasks/summary`
- `GET /admin/members`
- `POST /admin/identities/{id}/audit`
- `GET /plots`
- `POST /admin/plots/{id}/verify`
- `GET /admin/plots/{id}/media`
- `POST /admin/plots/{id}/media`
- `DELETE /admin/plots/{id}/media/{mediaId}`
- `GET /work-orders`
- `POST /work-orders/{id}/dispatch`
- `GET /supply-listings`
- `POST /admin/supply-listings/{id}/audit`
- `GET /field-templates`
- `POST /field-templates/{id}/versions`
- `POST /field-templates/{id}/publish`
- `GET /admin/audit-logs`
- `GET /admin/ops-elevations`
- `POST /admin/approvals/{id}/decide`
- `GET|POST|PATCH|DELETE /admin/administrators`
- `PUT /admin/administrators/{id}/permissions`
- `GET|POST|PATCH|DELETE /admin/subject-types`
- `GET|POST|PATCH|DELETE /admin/locations`
- `GET /admin/members/{id}/ratings`
- `GET /admin/members/{id}/activities`
- `GET|POST|PATCH /admin/members/{id}/remediation-plans`
- `GET /admin/member-tasks/{taskId}`
- `POST /admin/members/{id}/identities`

### 微信小程序

- `GET /home/feed`
- `GET /resources/map`
- `GET|POST|PATCH /plots`
- `GET|POST /service-requests`
- `GET /work-orders?mine=true`
- `POST /work-orders/{id}/check-ins`
- `POST /work-orders/{id}/fulfillments`
- `POST /work-orders/{id}/acceptance`
- `GET|POST /farm-activities`
- `POST /farm-activities/sync`
- `GET /messages`
- `POST /messages/{id}/read`
- `POST /identities/{identityId}/switch`
- `POST /family-authorizations`
- `POST /family-authorizations/{id}/accept`

## 补充业务规则

### 市场接单与标准验收

- 服务需求发布后进入公开服务市场，符合服务类型、服务区域和资质条件的服务商可自主接单；后台不再为每笔需求指定唯一服务商。接单成功后建立履约工单，并用并发条件保证同一需求只能被一个服务商接单。
- 服务需求必须绑定已发布的验收标准版本。标准包含必填作业项、数量/面积、照片或其他证据要求；标准发布后不可原地修改，需求保存所引用的版本快照。
- 服务商提交完成后，系统按标准计算完成率。未达到标准的工单进入补作业或争议状态，不能直接标记为已完成；农户确认验收后才生成已确认农事记录。
- 完成率是只读派生指标，系统评分由完成率、准时率、验收结果、响应时效和取消率按后台发布的评分规则计算。用户评分只能由有效需求的农户在验收后提交一次，系统同时保留评分人、评分时间和规则版本。
- 服务商只能查看本人可接的公开需求和本人已接工单；农户只能查看自己的需求、验收标准和相关记录；后台可查看全量但每次状态或评分变更都写入审计日志。

- 一个会员可同时拥有种植户、供应商、采购商、服务商、代录人员等多个身份；身份分别审核、统一归属同一会员。
- 主体评级分为系统评分与客户评分。任务完成度按“已完成任务数 ÷ 应完成任务数”计算；系统评分综合任务完成度、准时率、验收结果、响应时效和取消率，客户评分仅允许在有效任务完成后提交。
- 任务完成度为只读派生指标，接口同时返回 `assignedTasks`、`completedTasks`、`overdueTasks`、`canceledTasks` 与 `taskCompletion`；后台不得直接修改完成度或评分。
- 地块必填名称、面积和所在地；定位坐标、海拔、采集方式及采集人必须留痕。支持手机定位、地图选点、拍照识别、语音辅助、后台录入和子女远程代录。
- 子女代录前须由会员授权，农事记录必须保存授权关系、代办人、实际记录时间与提交时间，会员可撤销授权。

## 产品价值扩展契约草案（尚未实现）

2026-10-06追加。网页与小程序已有本地交互原型；以下不是可调用API，不更改生产网关503边界。真实对象、租户、成员身份和权限须服务端核验，不能根据客户端传入role、accountId或plotId授予权限。

| 建议对象 / 接口 | 行为与约束 |
| --- | --- |
| HarvestBatch / SourceLink | 同一地块分次采收分批；混合批关联全部来源，保存实物交接依据，不把单户记录套给整批产品 |
| GET /public/product-passports/{batchId} | 仅已审核且有公开授权的版本；白名单字段，不带原始GPS、卡号、家庭授权、私人成本或凭据 |
| POST /product-passports/drafts | 关联地块版本、产季、批次、核验依据和公开范围；原始记录与公开投影分开存储 |
| POST /admin/product-passports/{id}/reviews | 作者与编辑参与者不能自审；同一自然人跨账号也须拦截；版本变化、授权撤销、证据失效重新复核 |
| GET /supply-windows | 只返回主动授权的供货摘要；时间和数量区间、来源、更新时间、不确定性；预测不是现货 |
| POST /supply-subscriptions、POST /purchase-inquiries | 关注与询价非订单，不自动锁库、接受报价或向未授权主体发送信息；撤回供货后停止新增匹配 |
| POST /season-record-drafts | 产季记录：有来源摘要、人工编辑、媒体范围、本人公开确认；不得生成虚构检测、农户发言或质量承诺 |
| POST /private/income-scenarios | 生产科目与包装/冷链/配送/售后/卡片分摊分开，避免重复计入；现金与含劳动净收益区分；不公开底价、不当作已确认会计利润 |
| GET /shared-grade-matches、POST /grade-demands | kg/斤单位统一；异常货排除，核对货权和质量；匹配不锁库，交易另经事务预留和验收 |
| GET /private/season-comparisons | 同口径、带来源和版本；预测/实收区分，缺项不补造，不能将相关性作因果承诺 |
| GET /private/evidence-reminders、POST /followups | 按地块/受托工单授权；跟进不等于完工、解决或自动专业处方 |
| POST /fulfillment-feedback | 正式反馈关联有效批次/订单、证据和受理流程；不自动改账、退款、处罚或公开评分 |

所有写入需幂等键、版本前置条件和服务端审计。同步/签名/附件访问沿用统一安全底座。公开版本撤回、自然人去重、跨身份/跨中心对象隔离、库存数量与财务事务需联调验证；当前本机演示不能作为生产实现证据。
# 实现状态提示（2026-10-07）

以下为历史一期设计契约，不保证路径已经实现。本轮真实数据库联调接口以 [local-backend-v1.md](local-backend-v1.md) 和Java控制器为准。不要将原型短信验证码、沙箱响应或规划字段当作生产认证、支付、设备能力。
