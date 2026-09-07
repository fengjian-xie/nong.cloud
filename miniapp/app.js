const api = require('./utils/api')

App({
  globalData: { user: null, tenant: null },
  onLaunch() {
    this.bootstrap()
  },
  async bootstrap() {
    try {
      const session = wx.getStorageSync('fuan-session')
      if (!session) {
        const login = await api.wechatLogin('mock-wx-code')
        wx.setStorageSync('fuan-session', login.data)
      }
      const [user, tenant] = await Promise.all([api.getMe(), api.getTenantConfig()])
      this.globalData.user = user.data
      this.globalData.tenant = tenant.data
    } catch (error) {
      wx.showToast({ title: error.message || '登录失败', icon: 'none' })
    }
  }
})
