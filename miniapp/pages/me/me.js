const session = require('../../utils/session')
Page({
 data: { context: null }, onShow() { if(require('../../utils/connection').enabled())return wx.redirectTo({url:'/pages/connected/connected?module=applications'}); this.refresh() }, refresh() { this.setData({ context: session.current() }) }, switchChanged() { this.refresh() },
 login() { wx.navigateTo({ url: '/pages/login/login?tab=me' }) },
 application() { wx.navigateTo({ url: '/pages/module/module?id=application' }) },
 messages() { wx.switchTab({ url: '/pages/message/message' }) },
 help() { wx.navigateTo({ url: '/pages/help/help' }) },
 privacy() { wx.showModal({ title: '数据与隐私', content: '本版只在设备本地保存演示会话与草稿；不收集手机号，不上传定位，不访问摄像头或支付。统一退出会清理全部演示身份的本地数据。正式版须独立隐私政策及服务端对象授权。', showCancel: false }) },
 logout() { wx.showModal({ title: '统一退出', content: '退出所有身份，并清理本机演示会话、草稿和关注状态。不会自动重新登录。', success: r => { if (r.confirm) { session.logout(); this.refresh(); wx.reLaunch({ url: '/pages/index/index' }) } } }) }
})
