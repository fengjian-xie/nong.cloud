# nc.nong.cloud 乡桥农场

消费者端独立页面包括农场列表、地块详情、演示签约申请、我的农场/生长跟踪。
原先的y子域名方案已改为nc，不部署y。

这是用户批准的交互演示，没有真实地块经营资料、摄像头地址、合同或支付接口。
用户提供的福安葡萄照片是场景影像，不是直播画面；示例“镜头配置”筛选不表示实体设备已经安装。
地块页面可查看示例档案、记录时间线和认养方案；摄像头入口明确显示未接入，不自动播放假直播。
演示申请须确认无合同效力，不接受真实手机号称呼；保存、关注、撤回和清空均只修改当前浏览器数据，不发送订单或付款请求。
消费者不收平台服务费，不等于真实产品免费。价格、供货量、采收期和土壤检测以真实资料核验后为准。

构建：`npm run build -- --mode farm-site --base / --outDir /absolute/new/build-directory`。
独立入口为 `admin-web/src/cloudfarm/main.tsx`；摄像头、正式签约、履约和支付须另行接入。

2026-10-04发布版本：`/var/www/xiangqiao-cloud-farm/releases/20261004T072003Z`。
当前链接：`/var/www/xiangqiao-cloud-farm/current`。
配置：`/etc/nginx/conf.d/nc.nong.cloud.conf`。
备份：`/var/backups/xiangqiao-cloud-farm/20261004T072003Z`。
包SHA256：`467396fc6f4fa27988e92491b69b92b268771c325344b4970b2fbc0ae6e7afda`。
配置SHA256：`6ef0c2c026586367abc5a6ddccb673c2a222e771be39c9e86915fba993155613`。
HTTPS证书到期日2027-01-02，已配置自动续期。

缺失静态资源返回404；业务接口返回JSON503；页面深链由SPA处理。
首装脚本 `deploy_cloud_farm.py` 拒绝已有目录/配置，不可盲目重跑。后续更新应核对配置、current归属和备份，再原子切换版本；失败保留证据和回滚版本，不覆盖其他站点。
