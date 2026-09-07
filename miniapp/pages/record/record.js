const api = require('../../utils/api')
Page({
  data: { records: [], syncing: false, showForm: false, title: '', plot: '北山村·水稻田1号', remote: false, helper: '' },
  onShow() { this.load() },
  async load() { const records = (await api.getRecords()).data; this.setData({ records, pendingCount: records.filter(item => item.sync === '待同步').length }) },
  toggle() { this.setData({ showForm: !this.data.showForm }) },
  setTitle(e) { this.setData({ title: e.detail.value }) },
  toggleRemote(e) { this.setData({ remote: e.detail.value }) },
  setHelper(e) { this.setData({ helper: e.detail.value }) },
  inviteFamily() { wx.showShareMenu({ menus: ['shareAppMessage'] }); wx.showModal({ title: '邀请子女帮忙', content: '把当前页面分享给子女。子女经您授权后，可远程代填农事记录，每次代填都会标记代办人。', showCancel: false }) },
  onShareAppMessage() { return { title: '请帮我填写农事记录', path: '/pages/record/record?assist=1' } },
  async create() { if (!this.data.title) return wx.showToast({ title: '请输入记录内容', icon: 'none' }); if (this.data.remote && !this.data.helper) return wx.showToast({ title: '请填写代办人', icon: 'none' }); await api.createRecord({ title: this.data.title, plot: this.data.plot, remote: this.data.remote, helper: this.data.helper }); this.setData({ title: '', helper: '', remote: false, showForm: false }); await this.load(); wx.showToast({ title: '已保存为待同步' }) },
  async sync() { this.setData({ syncing: true }); await api.syncRecords(); await this.load(); this.setData({ syncing: false }); wx.showToast({ title: '同步完成' }) }
})
