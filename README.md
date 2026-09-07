# 福安一期：微信小程序与县域运营后台

本仓库依据《福安一期范围说明书》和《福安一期实施切片计划》实现两个前端应用：

- `admin-web/`：React + Vite + TypeScript 运营后台。
- `miniapp/`：原生微信小程序。
- `contracts/`：两端共用的 `/api/v1` 契约、响应信封与错误码说明。
- `design-concepts/`：界面视觉基准。

## 运行运营后台

首次在 Mac 或另一台电脑上编辑（先安装 Git 和 Node.js 22 LTS）：

```bash
git clone https://github.com/fengjian-xie/nong.cloud.git
cd nong.cloud/admin-web
npm ci
npm run dev
```

每次换电脑编辑前，在项目目录运行 `git pull --ff-only`；完成修改后运行 `git add .`、`git commit -m "描述本次修改"`、`git push`。推送需要该仓库的写入权限。依赖目录和本机私密配置不会同步。

```powershell
cd admin-web
npm install
npm run dev
```

登录手机号可输入任意合法的 11 位号码，Mock 验证码为 `000000`。

## 运行微信小程序

使用微信开发者工具导入 `miniapp/`，选择“不使用云服务”。项目内置与真实接口同形态的 Mock 层，无需后端即可走通一期主要流程。

## 当前实现边界

- 已覆盖六个实施切片的前端页面和主要 Mock 交互；服务需求按公开市场自由接单，按预设标准验收，并分别生成系统完成率评分与农户用户评分。
- 已补充系统设置增删改、管理员权限、多身份会员、系统/客户双评分、完整地块采集、子女远程代录及适老化入口。
- 财务、支付、追溯、隐私通话、跨县和 AI 能力未实现。
- 真实后端接入时，只需将两端 API 适配层从 Mock 切换为 `/api/v1` 请求；响应信封不变。
