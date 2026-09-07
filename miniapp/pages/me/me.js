const api = require('../../utils/api')
Page({
  data: { user: { name: '林春梅', phone: '138****6234', role: '种植户' }, identities: [{ id: 'grower', name: '种植户' }, { id: 'provider', name: '服务方' }], current: 'grower' },
  async switchRole(e) { const id = e.currentTarget.dataset.id; if (id === this.data.current) return; wx.showLoading({ title: '切换身份' }); await api.switchIdentity(id); wx.hideLoading(); this.setData({ current: id, 'user.role': id === 'grower' ? '种植户' : '服务方' }); wx.showToast({ title: '身份已切换' }) },
  goMessages() { wx.navigateTo({ url: '/pages/message/message' }) },
  logout() { wx.showModal({ title: '退出登录', content: '确定清理当前福安会话吗？', success: res => { if (res.confirm) { wx.removeStorageSync('fuan-session'); wx.reLaunch({ url: '/pages/index/index' }) } } }) }
})
