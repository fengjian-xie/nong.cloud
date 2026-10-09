const session = require('../../utils/session'), catalog = require('../../utils/catalog')
const choices = ['施肥', '修剪', '疏果', '灌溉', '采收', '其他作业']
Page({
 data: { context: null, choices, targetVersion: 1, deviceVersion: 1, keys: ['施肥','修剪','疏果'], acknowledged: false, error: '', saved: '', localEvents: [] },
 onShow() {
  if(require('../../utils/connection').enabled())return wx.redirectTo({url:'/pages/connected/connected?module=cards'})
  const ctx = session.current()
  if (!ctx || !catalog.hasCards(ctx.identity.role)) { this.setData({ context: null, error: '当前身份无卡片管理权限，请回工作台选择已绑定身份。' }); return }
  const config = session.read('card-config', { targetVersion: 1, keys: ['施肥','修剪','疏果'] })
  this.setData({ context: ctx, targetVersion: config.targetVersion, deviceVersion: 1, keys: config.keys, localEvents: session.read('card-events', []), error: '' })
 },
 choose(e) { const index = Number(e.currentTarget.dataset.index); const keys = this.data.keys.slice(); keys[index] = choices[Number(e.detail.value)]; this.setData({ keys, saved: '' }) },
 saveConfig() {
  if (!this.authorized()) return
  const config = { targetVersion: this.data.targetVersion + 1, keys: this.data.keys.slice() }
  session.save('card-config', config); this.setData({ targetVersion: config.targetVersion, saved: '目标配置已保存为本地草稿，等待真实设备下发与回执。' })
 },
 authorized() { const c = session.current(); return c && this.data.context && c.identity.id === this.data.context.identity.id && catalog.hasCards(c.identity.role) },
 simulate() {
  if (!this.authorized()) return
  // No device connection or server upload; historical version is fixed for this example.
  const localEvents = [{ id: 'demo-event-001', key: 'A', operation: '施肥', configVersion: 1, status: '本地模拟 · 未上传', location: '定位质量待确认' }]
  session.save('card-events', localEvents); this.setData({ localEvents, saved: '已读取一条模拟事件。重复操作不重复新增；无真实设备或云端回执。' })
 },
 back() { wx.switchTab({ url: '/pages/workspace/workspace' }) }
})
