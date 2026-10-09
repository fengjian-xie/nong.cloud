# 2026-10-05 五站发布准备

后续VI与新Slogan发布准备见 `FIVE-SITE-VI-RELEASE-2026-10-05.md`。以下为早前批次记录，不要上传其中的旧发布包或使用已过期临时授权。

状态：构建与本地验收完成，尚未发布。不能将本文件作为上线证明。

范围：nong.cloud、m.nong.cloud、nc.nong.cloud、api.nong.cloud、work.nong.cloud。旧域名及微信小程序不在本次发布范围；没有上线真实业务API、合同、支付、摄像头或项目申报系统。

本次内容：农户免平台服务费；农事记录卡办卡100元/张、补卡100元/张；首页农事卡示意、应用场景、成员申请准备、准入与执行验收标准、新LOGO及用户提供的农场图片；新增模块方案和项目支持清单下载入口。补贴仅为适配参考，窗口和资格待属地确认。

验证：186项前端测试、33项部署测试、lint、五个独立生产构建及实际压缩包安全解包检查通过。本地独立未登录Chrome验收1440×1000及390×844，包含申请清单、卡片收费、农场关注/演示意向跟踪、API本地沙箱及工作台多身份切换/刷新/未授权身份拦截。无相关控制台错误及业务POST；Safari未实机验证。

内置浏览器多次返回“js execution timed out; kernel reset, rerun your request”，按照用户既有独立浏览器验收授权改用现有Chrome，不读取用户浏览器资料。

构建目录（本机临时）：`/private/tmp/xiangqiao-five-release.s8PiXv`。仅下表构建包允许上传；不得打包该目录整体或上传私钥。

| 站点 | 构建包 | SHA256 |
| --- | --- | --- |
| nong.cloud | home.tar.gz | 38a9b7cd63f4ae28ff33408fd2b4e003ac601ef537f3adb14ed6903cd7ac4d93 |
| m.nong.cloud | admin.tar.gz | a6e77617a198a7840496b99dd6209530e8e67e3adde5cce420c12b6887ad0322 |
| nc.nong.cloud | farm.tar.gz | 86e0a543328aba39813cf1389448641a8ea513913eafcc809c2f0cb68f0ea389 |
| api.nong.cloud | api.tar.gz | 713e3060fccac48723aedfeec3c1f1e6e56e2f9e8bdee3ffff8cd7dff76278f9 |
| work.nong.cloud | work.tar.gz | 43d56ee2ff0f4e5dd3215521aead0ecd6d9a8ff213a858aeeeba2c53e4fde153 |

发布工具：home使用`deploy_home_site.py --update`，admin使用经重复更新测试的`update_admin_site.py`，API使用`update_api_portal.py`，farm/work使用新增`update_subject_site.py --site farm|work`。后者只切换归属已核实的current链接，不修改nginx或证书；失败回滚并保留旧版与备份。必须逐站顺序发布，避免保护校验相互冲突。

后续执行前重新核实五站配置、current归属、原首页及join.php指纹、API状态与证书；不要以旧部署文档中的配置散列替代现场核验。SSH服务器指纹已与此前网页终端确认值相符，不跳过主机验证或TLS校验。

访问阻碍：已获用户授权的新临时公钥尚未能通过网页终端安装；本次临时密钥及标准SSH登录检查均返回Permission denied。已向用户提供仅追加受限临时公钥的命令，请用户在现有root终端执行并回传输出。该公钥配置到2026-10-05北京时间17:00到期；需要在发布验收后立即移除精确授权行、验证新SSH连接拒绝，并删除本机临时私钥/公钥。当前没有修改服务器或既有登录设置。
