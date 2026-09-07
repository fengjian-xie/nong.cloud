const api = require('../../utils/api')
Page({
  data: { orders: [], showForm: false, plots: [], plotIndex: 0, services: ['水稻植保', '机械耕整', '施肥管理', '收获作业'], serviceIndex: 0, standards: [{ name: '福建省农业农村厅农产品质量安全生产规范', summary: '覆盖田间投入品、作业记录与采收安全要求，适用于本地主要粮食和果蔬服务。' }, { name: '宁德市农业农村局农事服务作业标准', summary: '明确植保、施肥、采摘、分拣等环节的操作流程、人员安全和验收要求。' }, { name: '福安市农业农村局本地补充规范', summary: '结合福安山地气候与特色产业制定，补充茶叶、果蔬等作业的本地执行细则。' }], standardIndex: 0, schedule: '明天上午' },
  onShow() { this.load() },
  async load() { const [orders, plots] = await Promise.all([api.getOrders(), api.getPlots()]); this.setData({ orders: orders.data, plots: plots.data }) },
  toggleForm() { this.setData({ showForm: !this.data.showForm }) },
  changePlot(e) { this.setData({ plotIndex: Number(e.detail.value) }) },
  changeService(e) { this.setData({ serviceIndex: Number(e.detail.value) }) },
  changeStandard(e) { this.setData({ standardIndex: Number(e.detail.value) }) },
  setSchedule(e) { this.setData({ schedule: e.detail.value }) },
  async submit() { const plot = this.data.plots[this.data.plotIndex]; if (!plot) return; await api.createRequest({ plot: plot.name, service: this.data.services[this.data.serviceIndex], standard: this.data.standards[this.data.standardIndex].name, schedule: this.data.schedule }); this.setData({ showForm: false }); await this.load(); wx.showToast({ title: '需求已进入市场' }) },
  openOrder(e) { wx.navigateTo({ url: `/pages/order/order?id=${e.currentTarget.dataset.id}` }) }
})
