const api = require('../../utils/api')
Page({
  data: { order: null, submitting: false },
  async onLoad(options) { const orders = (await api.getOrders()).data; this.setData({ order: orders.find(item => item.id === options.id) || orders[0] }) },
  async act() { const order = this.data.order; if (!order || order.action === 'none') return; const labels = { checkin: '确认按预设标准到场作业？', fulfill: '确认提交作业完成，进入标准验收？', accept: '确认按标准验收通过？', rate: '确认提交本次用户评分？' }; const result = await wx.showModal({ title: '市场服务操作', content: labels[order.action], confirmColor: '#087944' }); if (!result.confirm) return; this.setData({ submitting: true }); const payload = order.action === 'rate' || order.action === 'accept' ? { customerScore: 5 } : {}; const next = await api.orderAction(order.id, order.action, payload); this.setData({ order: next.data, submitting: false }); wx.showToast({ title: order.action === 'accept' ? '标准验收完成' : '操作成功' }) },
  actionLabel() { return '' }
})
