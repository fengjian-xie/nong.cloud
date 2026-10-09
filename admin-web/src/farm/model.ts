export type Card = {
  id: string; farmer: string; delegate: string; status: '未激活' | '已激活' | '已挂失'; battery: number
  lastSync: string; pending: number; firmware: string; version: number; deviceVersion: number
  keys: [string, string, string]; history: { version: number; keys: [string, string, string]; at: string }[]
}
export type FarmRecord = {
  id: string; cardId: string; farmer: string; plotId: string; operation: string; at: string
  source: '记录卡' | 'NFC服务' | '人工补录'; accuracy: number | null; configVersion: number
  synced: boolean; status: '待核验' | '已核验' | '已驳回'
  review?: { plotId: string; reason: string; at: string }
}
export type ProductionPlot = {
  id: string; name: string; owner: string; town: string; area: number; altitude: number
  crop: string; season: string; harvest: string; yieldKg: number; availableKg: number
  version: number; forecastPending?: boolean; archive: { year: string; crop: string; yieldKg: number }[]
}
export type Evidence = { name: string; kind: 'image' | 'video'; size: number }
export type CropChange = {
  id: string; plotId: string; crop: string; reason: string; evidence: Evidence[]; baseVersion: number
  status: '待审核' | '已通过' | '已驳回'; at: string; reviewReason?: string
}
export type SoilReport = {
  id: string; plotId: string; institution: string; sampleDate: string; ph: number; organic: number
  advice: string; reportNo: string; status: '待核验' | '已归档'
}
export type StockBatch = {
  id: string; plotId: string; product: string; grade: string; quantity: number; reserved: number
  sold: number; price: number; origin: '收购入库' | '共享库存'; owner: string; storage: string; expires: string
}
export type StockOrder = {
  id: string; batchId: string; buyer: string; quantity: number; price: number
  status: '已锁定' | '已出库' | '已取消'; at: string
}
export type Merchant = {
  id: string; name: string; type: string; mode: '年会员' | '按条查看'; fee: number; status: '待开通' | '已开通'
}
export type TraceJob = { id: string; plotId: string; status: '预检通过' | '模拟失败' | '模拟完成'; attempts: number; at: string; detail: string }
export type CostInput = { days: number; dayRate: number; inputs: number; services: number; other: number; yieldKg: number; markup: number }
export type FarmState = {
  cards: Card[]; records: FarmRecord[]; plots: ProductionPlot[]; changes: CropChange[]; soils: SoilReport[]
  batches: StockBatch[]; orders: StockOrder[]; merchants: Merchant[]; traces: TraceJob[]
  cost: CostInput; audit: { id: string; at: string; message: string }[]
}
export type Action = (
  | { type: 'configure'; id: string; keys: Card['keys'] }
  | { type: 'activate'; id: string; farmer: string; delegate: string; consent: boolean }
  | { type: 'cardStatus'; id: string; status: '已激活' | '已挂失' }
  | { type: 'sync'; id: string }
  | { type: 'reviewRecord'; id: string; plotId: string; reason: string; approve: boolean }
  | { type: 'cropChange'; change: Omit<CropChange, 'status' | 'at' | 'baseVersion'> }
  | { type: 'reviewChange'; id: string; approve: boolean; reason: string }
  | { type: 'forecast'; plotId: string; harvest: string; yieldKg: number; availableKg: number }
  | { type: 'soil'; report: SoilReport }
  | { type: 'archiveSoil'; id: string }
  | { type: 'purchase'; batch: StockBatch }
  | { type: 'reserve'; order: Omit<StockOrder, 'status' | 'at'> }
  | { type: 'orderStatus'; id: string; status: '已出库' | '已取消' }
  | { type: 'merchant'; id: string; mode: Merchant['mode']; fee: number }
  | { type: 'cost'; input: CostInput }
  | { type: 'trace'; plotId: string }
  | { type: 'traceRun'; id: string; fail: boolean }
) & { at: string; eventId: string }

export const operationOptions = ['施肥', '灌溉', '修剪', '除草', '植保', '采收', '巡田', '其他作业']
export const demoDate = '2026-08-29'
export const money = (amount: number) => amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const uid = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`
export const now = () => new Date().toLocaleString('sv-SE').replace('T', ' ')
export function createFarmSeed(): FarmState {
  const keys: Card['keys'] = ['施肥', '灌溉', '修剪']
  return {
    cards: Array.from({ length: 8 }, (_, i) => ({ id: `XQ-C${String(i + 1).padStart(4, '0')}`, farmer: ['林春梅', '陈建国', '叶秋香', '王国安', '郑美华', '吴秀兰', '待绑定', '待绑定'][i], delegate: i < 6 ? ['子女 · 林晓', '合作社 · 乡桥'][i % 2] : '未设置', status: i < 6 ? '已激活' : '未激活', battery: [86, 18, 65, 92, 54, 37, 100, 100][i], lastSync: i < 6 ? '2026-08-29 09:20' : '尚未连接', pending: [0, 2, 0, 0, 0, 1, 0, 0][i], firmware: 'EVT 0.3.1', version: 1, deviceVersion: 1, keys: [...keys], history: [{ version: 1, keys: [...keys], at: '2026-08-20 10:00' }] })),
    plots: [
      { id: 'SZT-001', name: '狮子头·葡萄示范园', owner: '林春梅', town: '赛岐镇狮子头村', area: 12, altitude: 24, crop: '阳光玫瑰葡萄', season: '2026产季', harvest: '2026-09-05', yieldKg: 18000, availableKg: 14000, version: 1, archive: [{ year: '2025', crop: '阳光玫瑰葡萄', yieldKg: 16200 }, { year: '2024', crop: '阳光玫瑰葡萄', yieldKg: 15000 }] },
      { id: 'PL20260826032', name: '溪尾村·葡萄园1号', owner: '穆云家庭农场', town: '赛岐镇溪尾村', area: 8.4, altitude: 38, crop: '巨峰葡萄', season: '2026产季', harvest: '2026-08-30', yieldKg: 10000, availableKg: 7000, version: 1, archive: [{ year: '2025', crop: '巨峰葡萄', yieldKg: 9800 }] },
      { id: 'PL20260820028', name: '康厝乡·葡萄园3号', owner: '叶秋香', town: '康厝乡康厝村', area: 7.3, altitude: 205, crop: '巨峰葡萄', season: '2026产季', harvest: '2026-09-12', yieldKg: 8200, availableKg: 6800, version: 1, archive: [{ year: '2025', crop: '巨峰葡萄', yieldKg: 7600 }] },
      { id: 'SZT-002', name: '狮子头·设施示范棚', owner: '陈建国', town: '赛岐镇狮子头村', area: 6, altitude: 22, crop: '夏黑葡萄', season: '2026产季', harvest: '2026-09-08', yieldKg: 7200, availableKg: 6000, version: 1, archive: [{ year: '2025', crop: '夏黑葡萄', yieldKg: 6800 }] },
    ],
    records: Array.from({ length: 14 }, (_, i) => ({ id: `REC-${String(i + 1).padStart(4, '0')}`, cardId: `XQ-C${String(i % 6 + 1).padStart(4, '0')}`, farmer: ['林春梅', '陈建国', '叶秋香', '王国安', '郑美华', '吴秀兰'][i % 6], plotId: ['SZT-001', 'SZT-002', 'PL20260820028', 'PL20260826032'][i % 4], operation: ['开工', '施肥', '灌溉', '修剪', '收工', '采收'][i % 6], at: `2026-08-${String(29 - Math.floor(i / 4)).padStart(2, '0')} ${String(8 + i % 9).padStart(2, '0')}:20`, source: i === 8 ? 'NFC服务' : '记录卡', accuracy: i === 1 ? 86 : i === 5 ? null : 5 + i % 8, configVersion: 1, synced: ![1, 7, 11].includes(i), status: i < 6 || [7, 11].includes(i) ? '待核验' : '已核验' })),
    changes: [],
    soils: [
      { id: 'SOIL-001', plotId: 'SZT-001', institution: '合作检测机构（演示）', sampleDate: '2026-08-15', ph: 6.2, organic: 24.5, advice: '结合目标产量、现有施肥量和检测结果制定分次施肥方案。此处为演示文本，不作为实际处方。', reportNo: 'DEMO-S20260815', status: '已归档' },
      { id: 'SOIL-002', plotId: 'SZT-002', institution: '合作检测机构（演示）', sampleDate: '2026-08-24', ph: 5.8, organic: 18.3, advice: '由农技人员现场复核后出具具体建议。', reportNo: 'DEMO-S20260824', status: '待核验' },
    ],
    batches: [
      { id: 'BATCH-001', plotId: 'SZT-001', product: '阳光玫瑰葡萄', grade: 'B级', quantity: 1500, reserved: 0, sold: 0, price: 4.8, origin: '共享库存', owner: '狮子头分拣车间（演示）', storage: '赛岐1号冷库', expires: '2026-09-08' },
      { id: 'BATCH-002', plotId: 'PL20260826032', product: '巨峰葡萄', grade: 'A级', quantity: 2400, reserved: 0, sold: 300, price: 7.2, origin: '收购入库', owner: '乡桥自营', storage: '赛岐1号冷库', expires: '2026-09-05' },
      { id: 'BATCH-003', plotId: 'SZT-002', product: '夏黑葡萄', grade: 'B级', quantity: 900, reserved: 0, sold: 0, price: 3.6, origin: '共享库存', owner: '赛岐农服合作社（演示）', storage: '赛岐2号冷库', expires: '2026-09-06' },
    ],
    orders: [],
    merchants: [
      { id: 'BUY-001', name: '宁德鲜果采购（演示）', type: '收购商', mode: '年会员', fee: 699, status: '已开通' },
      { id: 'BUY-002', name: '福安果品加工（演示）', type: '加工商', mode: '按条查看', fee: 9.9, status: '待开通' },
      { id: 'BUY-003', name: '乡桥农资合作门店（演示）', type: '农资商', mode: '年会员', fee: 999, status: '待开通' },
    ],
    traces: [], cost: { days: 120, dayRate: 180, inputs: 16000, services: 6000, other: 4400, yieldKg: 16000, markup: 35 }, audit: [],
  }
}

const requireValue = (condition: unknown, message: string) => { if (!condition) throw new Error(message) }
const positive = (n: number) => Number.isFinite(n) && n > 0
const nonnegative = (n: number) => Number.isFinite(n) && n >= 0
export function costEstimate(input: CostInput) {
  requireValue(Object.values(input).every(n => nonnegative(n) && n <= 100000000) && positive(input.yieldKg) && input.markup <= 100, '请输入有效的非负成本、正数产量和0–100%的加价率')
  const labour = input.days * input.dayRate
  const cash = input.inputs + input.services + input.other
  const full = cash + labour
  requireValue(Number.isSafeInteger(Math.round(full * 100)) && Number.isSafeInteger(Math.round(full / input.yieldKg * (1 + input.markup / 100) * 100)), '计算超出安全金额范围，请缩小统计范围')
  return { labour, cash, full, cashPerKg: cash / input.yieldKg, fullPerKg: full / input.yieldKg, referencePrice: full / input.yieldKg * (1 + input.markup / 100) }
}
export const available = (batch: StockBatch) => batch.quantity - batch.reserved - batch.sold
export function traceIssues(state: FarmState, plotId: string): string[] {
  const plot = state.plots.find(p => p.id === plotId)
  if (!plot) return ['地块不存在']
  const records = state.records.filter(r => (r.review?.plotId || r.plotId) === plotId)
  return [
    plot.forecastPending ? '种植变更后成熟期与产量需重新核实' : '',
    !records.some(r => r.synced && r.status === '已核验') ? '缺少已同步且已核验的农事记录' : '',
    records.some(r => r.status === '待核验') ? '尚有待核验农事记录' : '',
    state.changes.some(c => c.plotId === plotId && c.status === '待审核') ? '种植信息变更尚未审核' : '',
    !state.soils.some(s => s.plotId === plotId && s.status === '已归档') ? '缺少归档土壤报告（乡桥试点规则）' : '',
  ].filter(Boolean)
}

// Pure transition function: original events and old crop versions are never overwritten by review actions.
export function transition(state: FarmState, action: Action): FarmState {
  let next = state
  let message = ''
  const card = 'id' in action ? state.cards.find(c => c.id === action.id) : undefined
  switch (action.type) {
    case 'configure': {
      requireValue(card?.status === '已激活', '只有已激活卡片可以配置按键')
      requireValue(action.keys.length === 3 && action.keys.every(k => operationOptions.includes(k)), '请选择有效的A、B、C作业内容')
      next = { ...state, cards: state.cards.map(c => c.id === action.id ? { ...c, keys: action.keys, version: c.version + 1, history: [...c.history, { version: c.version + 1, keys: action.keys, at: action.at }] } : c) }
      message = `${action.id} 发布按键配置，等待设备回执`; break
    }
    case 'activate': {
      requireValue(card?.status === '未激活', '该卡片已激活或已挂失')
      requireValue(action.farmer.trim() && action.delegate.trim() && action.consent, '请填写农户、代办人并确认已获得授权')
      next = { ...state, cards: state.cards.map(c => c.id === action.id ? { ...c, farmer: action.farmer.trim(), delegate: action.delegate.trim(), status: '已激活' } : c) }
      message = `${action.id} 演示绑定 ${action.farmer}`; break
    }
    case 'cardStatus': {
      requireValue(card && card.status !== '未激活', '未激活卡片不能挂失或恢复')
      next = { ...state, cards: state.cards.map(c => c.id === action.id ? { ...c, status: action.status } : c) }
      message = `${action.id} ${action.status}`; break
    }
    case 'sync': {
      requireValue(card?.status === '已激活', '只有已激活卡片可以模拟同步')
      next = { ...state, cards: state.cards.map(c => c.id === action.id ? { ...c, pending: 0, deviceVersion: c.version, lastSync: action.at } : c), records: state.records.map(r => r.cardId === action.id ? { ...r, synced: true } : r) }
      message = `${action.id} 模拟蓝牙同步完成（未连接实物）`; break
    }
    case 'reviewRecord': {
      requireValue(state.records.some(r => r.id === action.id && r.status === '待核验'), '记录不存在或已处理')
      requireValue(action.reason.trim().length >= 5, '核验说明至少5个字')
      requireValue(state.plots.some(p => p.id === action.plotId), '请选择地块')
      requireValue(!action.approve || state.records.find(r => r.id === action.id)?.synced, '离线记录需先同步再核验')
      next = { ...state, records: state.records.map(r => r.id === action.id ? { ...r, status: action.approve ? '已核验' : '已驳回', review: { plotId: action.plotId, reason: action.reason.trim(), at: action.at } } : r) }
      message = `${action.id} ${action.approve ? '核验通过' : '驳回'}，保留原始事件`; break
    }
    case 'cropChange': {
      const plot = state.plots.find(p => p.id === action.change.plotId)
      requireValue(plot && action.change.crop.trim() && action.change.reason.trim().length >= 5, '请填写新作物和至少5个字的变更原因')
      requireValue(!state.changes.some(c => c.plotId === action.change.plotId && c.status === '待审核'), '该地块已有待审核变更')
      requireValue(action.change.evidence.some(e => e.kind === 'image') && action.change.evidence.some(e => e.kind === 'video'), '变更必须同时提供照片和视频')
      requireValue(action.change.evidence.every(e => e.size > 0 && e.size <= (e.kind === 'image' ? 10 : 100) * 1024 * 1024), '照片不超过10MB，视频不超过100MB，文件不能为空')
      next = { ...state, changes: [{ ...action.change, crop: action.change.crop.trim(), baseVersion: plot!.version, status: '待审核', at: action.at }, ...state.changes] }
      message = `${action.change.plotId} 提交种植变更（仅保存演示附件元数据）`; break
    }
    case 'reviewChange': {
      const change = state.changes.find(c => c.id === action.id)
      const plot = state.plots.find(p => p.id === change?.plotId)
      requireValue(change?.status === '待审核' && plot?.version === change.baseVersion, '变更已处理或档案版本已过期')
      requireValue(action.reason.trim().length >= 5, '审核说明至少5个字')
      next = { ...state, changes: state.changes.map(c => c.id === action.id ? { ...c, status: action.approve ? '已通过' : '已驳回', reviewReason: action.reason.trim() } : c), plots: state.plots.map(p => p.id === change!.plotId && action.approve ? { ...p, crop: change!.crop, version: p.version + 1, forecastPending: true, archive: [{ year: `${p.season} / v${p.version}`, crop: p.crop, yieldKg: p.yieldKg }, ...p.archive] } : p) }
      message = `${change!.plotId} 变更${action.approve ? '通过，旧版本留档' : '驳回'}`; break
    }
    case 'forecast': {
      requireValue(state.plots.some(p => p.id === action.plotId), '地块不存在')
      requireValue(!state.changes.some(c => c.plotId === action.plotId && c.status === '待审核'), '请先处理待审核的种植变更')
      requireValue(/^\d{4}-\d{2}-\d{2}$/.test(action.harvest) && Number.isFinite(new Date(`${action.harvest}T00:00:00`).getTime()), '请选择有效的预计成熟日期')
      requireValue(positive(action.yieldKg) && nonnegative(action.availableKg) && action.availableKg <= action.yieldKg, '预测产量须大于0，意向供应不能超过总产量')
      next = { ...state, plots: state.plots.map(p => p.id === action.plotId ? { ...p, harvest: action.harvest, yieldKg: action.yieldKg, availableKg: action.availableKg, forecastPending: false } : p) }
      message = `${action.plotId} 更新演示成熟与产量预测，非交付承诺`; break
    }
    case 'soil': {
      const r = action.report
      requireValue(state.plots.some(p => p.id === r.plotId), '请选择地块')
      requireValue(r.institution.trim() && r.reportNo.trim() && r.sampleDate && r.advice.trim(), '请补全机构、报告编号、日期和建议')
      requireValue(nonnegative(r.ph) && r.ph <= 14 && nonnegative(r.organic), 'pH范围0–14，有机质不能为负数')
      requireValue(!state.soils.some(s => s.reportNo === r.reportNo), '报告编号已存在')
      next = { ...state, soils: [{ ...r, status: '待核验' }, ...state.soils] }; message = `${r.reportNo} 登记，待核验`; break
    }
    case 'archiveSoil':
      requireValue(state.soils.some(s => s.id === action.id && s.status === '待核验'), '报告不存在或已归档')
      next = { ...state, soils: state.soils.map(s => s.id === action.id ? { ...s, status: '已归档' } : s) }; message = `${action.id} 演示归档`; break
    case 'purchase': {
      const b = action.batch
      requireValue(state.plots.some(p => p.id === b.plotId), '请选择来源地块')
      requireValue(positive(b.quantity) && positive(b.price) && b.storage.trim() && b.product.trim(), '请填写正数净重、单价和库位')
      requireValue(b.expires >= action.at.slice(0, 10), '保鲜截止日不能早于入库日')
      next = { ...state, batches: [{ ...b, quantity: Math.round(b.quantity * 1000) / 1000, reserved: 0, sold: 0, origin: '收购入库', owner: '乡桥自营' }, ...state.batches] }; message = `${b.id} 收购入库，未执行付款`; break
    }
    case 'reserve': {
      const batch = state.batches.find(b => b.id === action.order.batchId)
      requireValue(batch && positive(action.order.quantity) && action.order.quantity <= available(batch), '锁定数量必须大于0且不超过可用库存')
      requireValue(action.order.buyer.trim(), '请填写采购主体')
      requireValue(positive(action.order.price), '成交单价必须大于0')
      requireValue(batch!.expires >= demoDate, '该演示批次已超过保鲜期限')
      next = { ...state, batches: state.batches.map(b => b.id === batch!.id ? { ...b, reserved: b.reserved + action.order.quantity } : b), orders: [{ ...action.order, buyer: action.order.buyer.trim(), status: '已锁定', at: action.at }, ...state.orders] }
      message = `${action.order.id} 锁定${action.order.quantity}kg（未付款）`; break
    }
    case 'orderStatus': {
      const order = state.orders.find(o => o.id === action.id)
      requireValue(order?.status === '已锁定', '只有锁定订单可以出库或取消，不能重复处理')
      next = { ...state, orders: state.orders.map(o => o.id === action.id ? { ...o, status: action.status } : o), batches: state.batches.map(b => b.id === order!.batchId ? { ...b, reserved: b.reserved - order!.quantity, sold: b.sold + (action.status === '已出库' ? order!.quantity : 0) } : b) }
      message = `${action.id} ${action.status}`; break
    }
    case 'merchant':
      requireValue(state.merchants.some(m => m.id === action.id), '商家不存在')
      requireValue(nonnegative(action.fee) && action.fee <= 999, '试点服务费范围0–999元')
      next = { ...state, merchants: state.merchants.map(m => m.id === action.id ? { ...m, mode: action.mode, fee: action.fee, status: '已开通' } : m) }; message = `${action.id} 保存演示商家方案，不产生扣费`; break
    case 'cost':
      costEstimate(action.input); next = { ...state, cost: action.input }; message = '已保存授权示例的成本测算'; break
    case 'trace': {
      const issues = traceIssues(state, action.plotId)
      requireValue(!issues.length, issues.join('；'))
      requireValue(!state.traces.some(t => t.plotId === action.plotId), '该地块已生成任务，请查看或重试原任务')
      next = { ...state, traces: [{ id: `DEMO-${action.eventId}`, plotId: action.plotId, status: '预检通过', attempts: 0, at: action.at, detail: '内部预检通过，尚未向外部平台发送' }, ...state.traces] }; message = `${action.plotId} 内部预检通过`; break
    }
    case 'traceRun': {
      const job = state.traces.find(t => t.id === action.id)
      requireValue(job && job.status !== '模拟完成', '任务不存在或模拟已完成')
      const issues = traceIssues(state, job!.plotId)
      requireValue(!issues.length, `数据已发生变化，请先处理：${issues.join('；')}`)
      next = { ...state, traces: state.traces.map(t => t.id === action.id ? { ...t, attempts: t.attempts + 1, status: action.fail ? '模拟失败' : '模拟完成', detail: action.fail ? '模拟网络超时，可重试原任务' : '本地演示完成，无一品一码正式回执' } : t) }; message = `${action.id} ${action.fail ? '模拟失败' : '模拟完成'}`; break
    }
    default: throw new Error('不支持的演示操作')
  }
  return { ...next, audit: [{ id: action.eventId, at: action.at, message }, ...state.audit].slice(0, 200) }
}
