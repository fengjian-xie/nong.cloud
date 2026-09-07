const data = require('./mock-data')
let trace = 1
const wait = (ms = 260) => new Promise(resolve => setTimeout(resolve, ms))
const envelope = value => ({ code: 0, message: 'OK', data: value, traceId: `mock-fuan-${String(trace++).padStart(6, '0')}`, timestamp: new Date().toISOString() })

async function respond(value, ms) { await wait(ms); return envelope(value) }

module.exports = {
  wechatLogin: code => respond({ token: `mock-token-fuan-${code}`, user: { id: 'U001', name: '林春梅' } }, 420),
  getMe: () => respond({ id: 'U001', name: '林春梅', phone: '138****6234', role: '种植户', identities: [{ id: 'grower', name: '种植户' }, { id: 'provider', name: '服务方' }] }),
  getTenantConfig: () => respond({ tenantCode: 'fuan', countyCode: '350981', countyName: '福安市', features: { supply: false, payment: false, trace: false } }),
  getHome: () => respond({ resources: [{ name: '农机服务', distance: '1.2km', icon: '🚜' }, { name: '农资门店', distance: '1.6km', icon: '🏪' }, { name: '技术人员', distance: '2.1km', icon: '👨‍🌾' }], services: ['耕整地', '播种育苗', '植保防治', '施肥管理', '收获作业'], reminder: { crop: '水稻（福两优1002）', date: '9月5日', plot: '北山村·水稻田1号' }, syncCount: data.records.filter(item => item.sync === '待同步').length }),
  getPlots: () => respond(data.plots.map(item => ({ ...item }))),
  createPlot: form => { const item = { id: `PL${Date.now()}`, ...form, status: '审核中', tone: 'pending' }; data.plots.unshift(item); return respond(item, 460) },
  getOrders: () => respond(data.orders.map(item => ({ ...item }))),
  createRequest: form => { const item = { id: `WO${Date.now()}`, title: `${form.service}服务`, plot: form.plot, crop: '—', standard: form.standard, status: '市场接单中', provider: '待服务商接单', schedule: form.schedule, completionRate: 0, systemScore: null, customerScore: null, action: 'none' }; data.orders.unshift(item); return respond(item, 480) },
  orderAction: (id, action, payload = {}) => { const item = data.orders.find(order => order.id === id); if (item) { if (action === 'claim') { item.status = '待作业'; item.provider = payload.provider || '当前服务商'; item.action = 'checkin' } if (action === 'checkin') { item.status = '作业中'; item.action = 'fulfill'; item.completionRate = 50 } if (action === 'fulfill') { item.status = '待标准验收'; item.action = 'accept'; item.completionRate = 100 } if (action === 'accept') { item.status = '已完成'; item.action = 'rate'; item.systemScore = payload.systemScore || 5; item.customerScore = payload.customerScore || null } if (action === 'rate') { item.customerScore = payload.customerScore || 5; item.action = 'none' } } return respond(item, 520) },
  getRecords: () => respond(data.records.map(item => ({ ...item }))),
  createRecord: form => { const item = { id: `FA${Date.now()}`, ...form, date: '刚刚', source: form.remote ? `${form.helper || '家属'}远程代录` : '本人录入', sync: '待同步', clientSeq: `local-${Date.now()}` }; data.records.unshift(item); return respond(item) },
  syncRecords: async () => { await wait(700); data.records.forEach(item => { if (item.sync === '待同步') item.sync = '已同步' }); return envelope({ items: data.records.map(item => ({ clientSeq: item.clientSeq, result: 'success' })) }) },
  getMessages: () => respond(data.messages.map(item => ({ ...item }))),
  readMessage: id => { const item = data.messages.find(message => message.id === id); if (item) item.read = true; return respond(item) },
  switchIdentity: id => respond({ identityId: id, token: `mock-token-fuan-${id}-${Date.now()}` }, 450)
}
