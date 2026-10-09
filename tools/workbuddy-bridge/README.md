# 乡桥 WorkBuddy 专用桥接工具（本地调试版）

日期：2026-10-08（北京时间）。

## 验收状态

- 本机 WorkBuddy 桌面版：5.7.6；其内置 CodeBuddy CLI：2.156.0。
- 本地 MCP stdio 握手、工具发现及状态调用通过；12 项自动化测试通过。
- 固定文字真实调用未通过：CLI 返回登录提示，但进程退出码为 0。桥接层已修正此类误判，不把退出码 0 当作模型已回复。
- 将 CLI 配置目录指向桌面 WorkBuddy 目录后仍为登录提示；不证明桌面账号未登录，只说明不能据此复用桌面登录态。
- 用户选择稍后登录，故停止后续真实联网调用，未发送乡桥项目内容进行审查。
- 没有安装到 Codex 全局配置，也没有成为当前聊天的动态工具；配置示例仅供后续注册。

## 三个工具

| 工具 | 功能 | 边界 |
| --- | --- | --- |
| `workbuddy_status` | 检查已安装 CLI、版本及限制 | 不调用模型；不声称登录已验证 |
| `workbuddy_probe` | 仅发送固定测试句，要求准确回复 `WORKBUDDY_BRIDGE_READY` | 会使用供应商网络和额度；不包含业务文件 |
| `workbuddy_review_snapshot` | 审查调用者明确提供的文本 | 默认关闭；仅返回建议；无文件/命令/支付工具 |

调用的是**WorkBuddy 随附的独立 CodeBuddy CLI 会话**，不是接管桌面聊天；不会自动共享桌面聊天或当前 Codex 对话历史。这不是腾讯或 OpenAI 官方提供的跨产品连接器，而是乡桥项目内的本地桥接代码。

## 运行

工具目录：

`/Users/xiexiansheng/Downloads/合作社/m.nong.cloud/nong.cloud/tools/workbuddy-bridge`

依赖已安装在该目录；安装时使用 `--ignore-scripts`。仅安装官方 MCP SDK 与其依赖，没有执行未知第三方桥接包。

```bash
cd "/Users/xiexiansheng/Downloads/合作社/m.nong.cloud/nong.cloud/tools/workbuddy-bridge"
npm ci --ignore-scripts --no-audit --no-fund
npm test
node diagnose.mjs
```

`diagnose.mjs` 会启动本工具进程，进行真正的 MCP 协议握手，调用工具发现和本机 CLI 版本检查，但不会调用模型。测试中的模型结果来自明确标注的确定性替身，不能充当真实联动证据。

完成 CLI 登录后，执行：

```bash
node diagnose.mjs --live
```

只有返回 `liveProbe.ok=true` 及精确测试标记，才算模型连接验证通过。登录诊断失败以退出码 2 结束，协议失败以退出码 1 结束。

## 待完成：CLI 登录与注册

在本人终端运行以下**已经安装**的官方客户端，按提示登录；不要复制、发送或提交二维码、验证码、Token 或证书：

```bash
/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/cli/bin/codebuddy
```

然后重新执行真实连接测试。必要时按照腾讯官方提示处理账户或 CLI 登录，不能通过手工复制桌面凭证来绕过登录。

`codex.config.example.toml` 是现有本机路径的 MCP 配置示例。后续注册应先检查并合并目标配置，而不是覆盖原配置；需要重新载入工具列表。当前聊天没有自动获得这些工具。

不要把 `codex app-server` 当作 MCP server：它有不同的 JSON-RPC 协议。此桥接工具本身才是 MCP server。

## 安全设计与已知限制

- 使用 Node 直接启动固定 CLI 路径，`shell:false`，不接收调用者指定的命令、可执行路径或工作目录。
- CLI 默认在新建的空临时目录运行，避免自动加载乡桥仓库内的项目指令。临时目录及官方客户端正常启动缓存保留；不删除用户资料。
- 内置工具列表为空，外部 MCP 配置为空且严格隔离，插件配置及钩子关闭，权限模式为 `plan`，会话不持久保存。
- 不使用 `-y`、`--dangerously-skip-permissions`，不启动无鉴权 HTTP 服务，不开放端口，不修改全局权限或登录设置。
- 仅继承正常系统路径/语言/代理配置，不继承父进程的数据库密码、API Key 等业务环境变量；官方客户端仍需自行处理自身登录与启动缓存。
- 默认 45 秒截止，超时终止本工具启动的子进程；同一服务进程同时只接受一个模型请求。
- 日志不输出上游原始 stdout/stderr，不打印凭证、HTTP 头或堆栈；将权限、网络、登录、额度问题分别分类。
- 审查入口默认关闭；启用后也不自动读取项目。基础敏感文本检测/输出遮盖并非完整 DLP，不能提供生产凭证、真实个人信息、账单或合同。
- 审查结果只是另一个模型的建议，不等于修改已完成或测试已通过；不得自动执行其返回的命令。
- 使用固定依赖版本及 lockfile；目前为 macOS 本机开发工具，其他操作系统未验收。

## 官方参考

- [腾讯 CLI 无头模式](https://www.workbuddy.cn/docs/cli/headless)
- [腾讯 CLI 环境变量：配置目录、遥测等](https://www.workbuddy.cn/docs/cli/env-vars)
- [OpenAI Docs：外部 MCP 与旧 Codex MCP server 的区别](https://learn.chatgpt.com/docs/mcp-server)
- [OpenAI Docs：构建 MCP server](https://developers.openai.com/plugins/build/mcp-server)
