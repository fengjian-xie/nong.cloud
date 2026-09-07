const api = require('../../utils/api')
Page({
  data: { plots: [], query: '', showForm: false, methods: ['手机自动定位', '地图选点', '拍照识别', '语音辅助', '子女远程代录'], form: { name: '', area: '', crop: '', town: '', altitude: '', longitude: '', latitude: '', collectionMethod: '手机自动定位' } },
  onShow() { this.load() },
  async load() { this.setData({ plots: (await api.getPlots()).data }) },
  search(e) { this.setData({ query: e.detail.value }) },
  toggleForm() { this.setData({ showForm: !this.data.showForm }) },
  setField(e) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value }) },
  chooseMethod(e) { this.setData({ 'form.collectionMethod': e.currentTarget.dataset.method }) },
  useLocation() { wx.getLocation({ type: 'gcj02', altitude: true, success: ({ longitude, latitude, altitude }) => { this.setData({ 'form.longitude': longitude.toFixed(6), 'form.latitude': latitude.toFixed(6), 'form.altitude': altitude ? Math.round(altitude) : '', 'form.collectionMethod': '手机自动定位' }); wx.showToast({ title: '定位成功' }) }, fail: () => wx.showToast({ title: '定位失败，可改用地图选点', icon: 'none' }) }) },
  chooseMap() { wx.chooseLocation({ success: ({ name, address, longitude, latitude }) => this.setData({ 'form.town': address || name, 'form.longitude': longitude.toFixed(6), 'form.latitude': latitude.toFixed(6), 'form.collectionMethod': '地图选点' }) }) },
  scanPhoto() { wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['camera', 'album'], success: () => { this.setData({ 'form.collectionMethod': '拍照识别' }); wx.showToast({ title: '照片已采集' }) } }) },
  voiceHelp() { this.setData({ 'form.collectionMethod': '语音辅助' }); wx.showModal({ title: '语音辅助', content: '请说出地块名称、面积和所在村。演示版将由工作人员复核录音。', showCancel: false }) },
  async submit() { const f = this.data.form; if (!f.name || !f.area || !f.town) return wx.showToast({ title: '请填写名称、面积和所在地', icon: 'none' }); await api.createPlot({ ...f, area: `${f.area}亩`, altitude: f.altitude ? `${f.altitude}米` : '待测量' }); this.setData({ showForm: false, form: { name: '', area: '', crop: '', town: '', altitude: '', longitude: '', latitude: '', collectionMethod: '手机自动定位' } }); await this.load(); wx.showToast({ title: '已提交核验' }) },
  filtered() { return this.data.plots }
})
