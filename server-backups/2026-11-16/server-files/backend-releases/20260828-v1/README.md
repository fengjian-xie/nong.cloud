# 乡桥现代农事综合服务平台后台 V1.0

依据《福安市现代农事综合服务平台系统架构设计书 V1.0》实现的第一期模块化单体。管理后台和 API 使用同一个 Spring Boot 应用部署，目标域名为 `nong.cloud`。

## 已实现

- 县域空间、账号、多身份、RBAC 与服务端县域上下文校验。
- 手机号 AES-GCM 加密存储、不可逆哈希检索、JWT 登录。
- 地块、成熟状态、公开级别、农事记录、客户端流水号幂等及 AI 内容确认。
- 冷库、分拣车间、茶厂、农资、植保、农机和农技资源。
- 农事需求、服务商报价、选定报价、工单状态机、履约完成后自动形成农事记录。
- 供应、采购及按所在地、品种、成熟度、面积、有效核验时间检索。
- 工单支付单、县域商户路由快照、模拟回调幂等处理。
- 1 元隐私电话连接单、24 小时重复联系免重复收费的基础规则。
- 一品一码、电力、天气、AI 等统一集成任务与模拟适配器。
- 县域运营管理端：看板、入驻审核、资源核验、供需审核、工单、同步任务、审计日志。
- Flyway 版本迁移、PostgreSQL/PostGIS 空间字段、事务 Outbox 和 Docker Compose。

## 本地测试

要求 Java 21 与 Maven 3.9+：

```bash
mvn test
```

## Docker 启动

```bash
cp .env.example .env
# 修改 .env 中全部密码和密钥
docker compose up -d --build
curl http://127.0.0.1:8080/actuator/health
```

首次管理员由 `BOOTSTRAP_OPERATOR_MOBILE` 与 `BOOTSTRAP_OPERATOR_PASSWORD` 创建。成功登录后应从 `.env` 删除这两个初始化变量并重启服务。

## 县域隔离说明

福安生产实例只连接福安业务库；`county_code` 仍保留为数据库内的纵深防御条件。新增县域时复制数据库模板并使用独立数据库、独立对象存储前缀、独立搜索路由和独立支付商户配置，不与福安业务库混用。总部控制面后续独立部署，仅保存县域元数据和运行状态。

## 外部接口

默认 `INTEGRATION_MODE=mock`，用于跑通业务和测试。微信支付、隐私号、福建一品一码、电力、天气和 AI 的生产适配器必须在取得正式接口文档、测试账号、签名密钥和回调白名单后启用，密钥不得写入源码或数据库明文字段。

## nong.cloud 部署

1. 将 `nong.cloud` 与 `www.nong.cloud` 的 A 记录指向服务器公网 IP。
2. 上传本目录，在服务器安装 Docker Engine、Compose 与 Nginx。
3. 配置 `.env`，运行 `docker compose up -d --build`。
4. 将 `deploy/nginx-nong.cloud.conf` 安装到 Nginx 站点目录并检查配置。
5. 使用 Certbot 申请证书，启用 HTTPS 后设置 HTTP 到 HTTPS 跳转。
6. 健康检查通过后访问 `https://nong.cloud/`。

生产上线前仍需完成真实支付/退款、虚拟号码回调、微信登录、一品一码、电力接口、对象存储、消息队列、备份恢复和等保/隐私评估。
