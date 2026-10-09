# 五站VI发布完成 — 2026-10-05（北京时间）

状态：五站已实际更新并通过服务器及独立浏览器验收。官网最后一轮补充更新已上线：“从这里，进入乡桥”中的管理后台、乡桥农场、开放API和用户工作台入口在新标签页打开；官网原页面保留。页内“了解乡桥业务体系”仍为锚点跳转。临时root SSH授权已撤销，新连接被拒绝，本次本机私钥和公钥已删除。本文件记录实际上线结果，不是待执行计划。

范围：只做五个PC/Web站点；小程序由用户结合WorkBuddy另行制作，本轮没有新增小程序或提交微信发布。没有修改域名DNS、登录设置或开放端口，没有提交真实合同、支付或业务订单。

## 当前线上版本及回滚备份

| 站点 | URL | 当前版本 | 本轮备份 |
| --- | --- | --- | --- |
| 乡桥农事中心 | https://nong.cloud/ | `/var/www/xiangqiao-home/releases/20261005T140926Z` | `/var/backups/xiangqiao-home/20261005T140926Z` |
| 管理后台 | https://m.nong.cloud/ | `/var/www/fuan-releases/20261005T135022Z` | `/var/backups/fuan-deploy/20261005T135022Z` |
| 乡桥农场 | https://nc.nong.cloud/ | `/var/www/xiangqiao-cloud-farm/releases/20261005T135317Z` | `/var/backups/xiangqiao-cloud-farm/20261005T135317Z` |
| 开放API文档 | https://api.nong.cloud/ | `/var/www/xiangqiao-api-portal/releases/20261005T135215Z` | `/var/backups/xiangqiao-api-portal/20261005T135215Z` |
| 用户工作台 | https://work.nong.cloud/ | `/var/www/xiangqiao-work/releases/20261005T135427Z` | `/var/backups/xiangqiao-work/20261005T135427Z` |

官网先发布 `20261005T134942Z` 的VI版本，再按用户新增要求发布 `20261005T140926Z` 的新标签页入口。两轮版本和备份均保留；最终官网上一版本为 `/var/www/xiangqiao-home/releases/20261005T134942Z`，之前的10月4日版本也未删除。

服务器：`8.141.88.22`，`iZ2ze1g23bw8f6jdqb0g95Z`。本次独立暂存目录为 `/root/xiangqiao-vi-upload.ZnzewQ`，只上传发布压缩包和必要脚本，没有上传临时密钥目录。

## 内容与真实业务边界

正式三笔乡标志、VI四色与字体层级、PC/手机网页排版、用户提供的产区和农场航拍照片、单排五键农事卡概念图已用于五站。品牌Slogan为“连接乡土，共享丰收”。保留农户免平台服务费、办卡100元/张、补卡100元/张，以及一个账号支持多种已绑定身份。

管理后台及主体端仍是前端演示，不能把本机角色选择当成正式RBAC。农场没有真实摄像头、正式合同或收款，测试只操作本机关注和演示意向；开放API仅为文档和本地沙箱，生产网关及硬件联动未实现。农事卡仍为概念/工程样机规划，不把设计目标当成已验证硬件能力。

## 发布包SHA256

| 站点 | 最终发布包SHA256 |
| --- | --- |
| nong.cloud | `09dbe9701ac6acab781c0b00a0ab352639d4cad12f9167271bae9b8b888aa3ad` |
| m.nong.cloud | `af7f0b9f637cbf95f0596096f67e98d2df6c50a4a8eeac21f8a694bd2b220f29` |
| nc.nong.cloud | `353ff7770b445d644906ceded3e231fa638454cd91501027e06a48fb71321464` |
| api.nong.cloud | `f587f4e125e176a64eadce71d6336f1ac46b10a3300cccde953e04993a39403d` |
| work.nong.cloud | `e380b6d9593679bff72624a9454e6e8b1f49546ed9c5bfb95707d7141851f5e6` |

五个独立构建均通过；最后的官网入口补充版本另行通过TypeScript/Vite构建并使用实际部署解包函数安全校验。压缩包无路径穿越、链接、密钥或环境配置；入口及资源路径有效。

## 验收

- 192项前端测试、lint、`git diff --check`通过；13项官网相关测试包含新标签页的target/rel属性和页内锚点回归。
- 48项既有发布/回滚及限时授权安全测试通过；本次精确撤销临时授权另有6项安全测试通过。
- 实际服务器逐站核对SHA256、证书域名/有效期、HTML/资源/深链、原业务基线及其他站点未变。`nginx -t`通过。已有80端口重复 `_` server_name警告未改动。
- 内置浏览器Workbench DOM读取多次超时并发生Node运行时重置；使用用户已允许的独立、未登录Chrome+Playwright替代验收。无依赖安装，不操作其登录会话。
- 五站1440×1000及390×844页面身份、非空白、无框架错误覆盖层、控制台/资源加载和截图检查通过。无相关控制台错误、页面异常、失败资源或文档横向溢出。
- 官网：四个入口逐个实际点击，分别产生正确域名新标签页，官网URL未变，新页面opener为空；业务页签、农事卡采购场景、本地申请清单、农资商准入标准通过。
- 管理后台：Mock登录、农事卡管理深链及100元收费展示通过。
- 农场：镜头筛选、摄像头尚未接入提示、档案页签、关注、本地演示申请/刷新恢复/撤回通过。
- API：按权限筛选目录，本地沙箱200成功及非法JSON400通过；并非真实HTTP成功。
- 工作台：单次演示登录、种植户/农服队切换、刷新保留身份、未绑定采购商深链阻断、全账号退出通过。
- 测试拦截实际写请求；未出现任何POST或其他真实业务写请求。没有付款、真实签约、硬件或生产数据测试。
- 公网官网原 `/api/v1/` 仍返回401；开放API、农场、工作台演示业务路径仍返回明确的503。原后台8080代理、五站TLS和业务文件均保留。
- Safari没有实机验收；Chrome响应式测试不代表Safari全部兼容。小程序、真实账号互通、摄像头、政府申报、正式合同及真实硬件接口不在本次上线范围。

临时QA脚本、结果和截图在 `/private/tmp/xiangqiao-vi-qa.oMO0Wr`，未放入源码或公开站点。命令为 `node /private/tmp/xiangqiao-vi-qa.oMO0Wr/verify-live.cjs`；结果为PASS。

## 最终保护核对

仅管理后台配置中的受管前端版本路径更新，后台8080代理和TLS部分不变。其最终配置SHA256为 `1f27baeafe113b0411ae1e1c030cf0504c2c9fce695253767f44f0d6a4b3127b`。其余四站配置SHA256与发布前完全一致。

原 `/var/www/nong.cloud/index.html` SHA256保持 `d20cc2b54b8903f2f5dbc32681ba75368c5283f3deac2db8f5c89f6d8dd63e8c`；原 `/var/www/xiangqiao-api/join.php` SHA256保持 `5b745093c9ab389f78d8667e75e618a8dc1662c929c17c8bcd67b43805bdf2d6`。最终current链接均与发布清单一致。

## 临时接入与清理（已验证）

旧HDGCJg临时授权截止21:00，原命令的Z后缀不兼容服务器OpenSSH8.0；用户修复时间格式后接入曾恢复，但未在该期限内开始发布。21:06拒绝重新连接，本地旧密钥已删除，没有擅自延长旧授权。

用户随后明确确认新限时授权。Gykn0U公钥指纹为 `SHA256:tts0u8vzldAYJolDJWWnwxGpfKAAnsI0oGGcxi4NerQ`，使用系统Asia/Shanghai14位时间，到期为当日22:30，保留restrict、不改SSH配置、不重启SSH、不开放新端口。用户粘贴后连接验证成功，才开始上传与发布。

验收后精确移除Gykn0U新授权和HDGCJg已过期授权共2行，没有盲目恢复整个历史authorized_keys。其他字节、归属、权限和inode均核验保留。撤销前备份为 `/root/.ssh/authorized_keys.before-xiangqiao-vi-revoke-20261005-Gykn0U`；它只是安全留档，不是后续授权依据，不应恢复这两条临时行。

撤销前SHA256为 `746dc01ddfa794d714947bbfd970e7e67d518c8e15929421d8151a3b17741863`，撤销后为 `a5235dac82813937e4f52cb100c38005e9601bb8f12c1dff978ed721ea914676`。新的严格主机校验SSH连接返回exit255、Permission denied，确认授权已失效。

之后删除经核实的 `/private/tmp/xiangqiao-vi-auth.Gykn0U/deploy_key` 和 `deploy_key.pub`，22:13目录检查确认无密钥文件。服务器版本、回滚备份及发布包保留。该删除仅涉及本任务生成的临时密钥，不涉及用户业务数据；本机私钥不再保留。未来服务器工作需要重新确认接入方式，所有旧临时授权命令均不应再次执行。
