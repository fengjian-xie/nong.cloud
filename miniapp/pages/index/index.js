const api = require('../../utils/api')
Page({
  data: { loading: true, feed: null },
  onShow() { this.load() },
  async load() { this.setData({ loading: true }); try { const { data } = await api.getHome(); this.setData({ feed: data }) } catch (e) { wx.showToast({ title: e.message || '加载失败', icon: 'none' }) } finally { this.setData({ loading: false }) } },
  goPlot() { wx.switchTab({ url: '/pages/plot/plot' }) },
  goService() { wx.switchTab({ url: '/pages/service/service' }) },
  goRecords() { wx.switchTab({ url: '/pages/record/record' }) },
  goMap() { wx.navigateTo({ url: '/pages/map/map' }) }
})
