Page({
 goWorkspace() { wx.switchTab({ url: '/pages/workspace/workspace' }) },
 goFarm() { wx.switchTab({ url: '/pages/farm/farm' }) },
 goApplication() { wx.navigateTo({ url: '/pages/module/module?id=application' }) },
 about() { wx.showModal({ title: '乡桥农业', content: '平台主体：乡桥农业有限公司。福安运营主体：福安市乡桥农事综合服务有限公司。首期计划在赛岐镇狮子头村开展500亩葡萄样板；为规划，不代表已完成。', showCancel: false }) }
})
