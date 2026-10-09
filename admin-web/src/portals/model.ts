import type { CostInput, FarmState, ProductionPlot } from '../farm/model'
import { costEstimate } from '../farm/model'
import { getRole, memberNames } from './config'
import type { RoleId } from './config'

export type ServiceProvider = 'machine' | 'team' | 'protection'
export type ServiceJob = { id: string; requester: 'farmer' | 'cooperative'; plotId: string; provider: ServiceProvider; operation: string; area: number; date: string; note: string; status: '待接单' | '已接单' | '作业中' | '待验收' | '已完成' | '已取消'; completion?: string; performedByAccountId?: string; acceptedByAccountId?: string }
export type ProtectionLog = { id: string; jobId: string; product: string; batch: string; amount: number; unit: string; area: number; safetyDays: number; note: string; at: string }
export type Offer = { plotId: string; crop: string; town: string; area: number; harvest: string; quantity: number; price: number; status: '已发布' | '已撤回'; version: number }
export type Demand = { id: string; actor: 'buyer' | 'processor'; product: string; grade: string; quantity: number; date: string; note: string; status: '征集中' | '已关闭' }
export type Sale = { id: string; cardId: string; customer: string; product: string; batch: string; quantity: number; unit: string; amount: number; at: string }
export type Sample = { id: string; plotId: string; customer: string; status: '待采样' | '已采样' | '待运营核验'; ph?: number; organic?: number; advice?: string; reportNo?: string; evidence?: string; date: string }
export type PortalState = {
  services: ServiceJob[]; offers: Offer[]; demands: Demand[]; sales: Sale[]; samples: Sample[]
  processing: { id: string; batchId: string; input: number; a: number; b: number; c: number; loss: number; at: string }[]
  costs: Record<string, CostInput>; family: { view: boolean; configure: boolean; stories: boolean }
  stories: { id: string; text: string; at: string }[]; assets: { id: string; role: ServiceProvider; name: string; status: '可预约' | '作业中' | '维护中' }[]
  protection: ProtectionLog[]
  memberships: { mode: '年会员' | '按条查看'; active: boolean; unlocked: string[] }
}
type Commands =
  | { type: 'request'; job: Omit<ServiceJob, 'status' | 'requester'> }
  | { type: 'serviceStatus'; id: string; status: ServiceJob['status']; completion?: string }
  | { type: 'offer'; offer: Offer }
  | { type: 'withdraw'; plotId: string }
  | { type: 'demand'; demand: Omit<Demand, 'actor' | 'status'> }
  | { type: 'closeDemand'; id: string }
  | { type: 'sale'; sale: Sale; consent: boolean }
  | { type: 'protection'; entry: ProtectionLog; confirmed: boolean }
  | { type: 'sample'; id: string }
  | { type: 'report'; id: string; ph: number; organic: number; advice: string; reportNo: string; evidence: string }
  | { type: 'process'; entry: PortalState['processing'][number] }
  | { type: 'cost'; plotId: string; input: CostInput }
  | { type: 'family'; permissions: PortalState['family'] }
  | { type: 'story'; text: string; id: string; at: string }
  | { type: 'asset'; id: string; status: PortalState['assets'][number]['status'] }
  | { type: 'membership'; mode: '年会员' | '按条查看' }
  | { type: 'unlock'; plotId: string }
export type PortalCommand = Commands
export type PortalAction = Commands & { role: RoleId; eventId: string; at: string; accountId?: string }
const ensure: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message) }
const positive = (value: number) => Number.isFinite(value) && value > 0 && value <= 100000000
const dateValid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

export function createPortalSeed(): PortalState {
  return {
    services: [
      { id: 'SRV-001', requester: 'farmer', plotId: 'SZT-001', provider: 'team', operation: '葡萄园修剪', area: 12, date: '2026-08-30', note: '进场前电话联系，保留作业交接记录。', status: '待接单' },
      { id: 'SRV-002', requester: 'cooperative', plotId: 'SZT-002', provider: 'machine', operation: '田间转运', area: 6, date: '2026-08-31', note: '合作社代社员预约；结算另行确认。', status: '已接单' },
      { id: 'SRV-003', requester: 'farmer', plotId: 'SZT-001', provider: 'protection', operation: '葡萄园植保作业', area: 12, date: '2026-09-01', note: '先现场诊断，施用时按登记标签与农技指导执行。', status: '已接单' },
    ],
    offers: [{ plotId: 'SZT-001', crop: '阳光玫瑰葡萄', town: '赛岐镇狮子头村', area: 12, harvest: '2026-09-05', quantity: 14000, price: 8.5, status: '已发布', version: 1 }],
    demands: [{ id: 'DEMAND-001', actor: 'processor', product: '阳光玫瑰葡萄', grade: 'B级', quantity: 1000, date: '2026-09-02', note: '分拣补货需求，1000kg = 2000斤；品质到货验收。', status: '征集中' }],
    sales: [], processing: [], costs: { 'SZT-001': { days: 100, dayRate: 180, inputs: 14000, services: 5000, other: 4000, yieldKg: 18000, markup: 35 } },
    family: { view: true, configure: false, stories: false }, stories: [], protection: [],
    samples: [{ id: 'SAMPLE-001', plotId: 'SZT-001', customer: '林春梅', status: '待采样', date: '2026-08-30' }, { id: 'SAMPLE-002', plotId: 'SZT-002', customer: '陈建国', status: '已采样', date: '2026-08-28' }],
    assets: [{ id: 'ASSET-001', role: 'machine', name: '果园转运机 · 示例01', status: '可预约' }, { id: 'ASSET-002', role: 'machine', name: '履带旋耕机 · 示例02', status: '维护中' }, { id: 'ASSET-003', role: 'team', name: '修剪与采收组 · 6人', status: '可预约' }, { id: 'ASSET-004', role: 'protection', name: '植保喷雾设备 · 示例01', status: '可预约' }],
    memberships: { mode: '年会员', active: true, unlocked: [] },
  }
}

// Presentation scoping for a prototype, not a replacement for server-side tenant/role authorization.
export function scopedPlots(farm: FarmState, state: PortalState, role: RoleId): ProductionPlot[] {
  if (role === 'farmer' || (role === 'family' && state.family.view)) return farm.plots.filter(p => p.owner === '林春梅')
  if (role === 'cooperative') return farm.plots.filter(p => memberNames.includes(p.owner))
  return []
}
export function publicOffers(farm: FarmState, state: PortalState) {
  return state.offers.filter(o => o.status === '已发布' && farm.plots.some(p => p.id === o.plotId && p.version === o.version && !p.forecastPending && p.crop === o.crop && p.harvest === o.harvest && o.quantity <= p.availableKg))
}
export function scopedJobs(state: PortalState, role: RoleId) {
  if (role === 'farmer' || role === 'cooperative') return state.services.filter(j => j.requester === role)
  if (role === 'machine' || role === 'team' || role === 'protection') return state.services.filter(j => j.provider === role)
  return []
}
export function scopedBatches(farm: FarmState, role: RoleId) {
  if (role === 'warehouse') return farm.batches.filter(b => b.storage === '赛岐1号冷库')
  if (role === 'cooperative' || role === 'processor') return farm.batches.filter(b => b.owner === getRole(role)?.actor)
  if (role === 'buyer') return farm.batches.filter(b => b.origin === '共享库存')
  return []
}
export function reducePortal(state: PortalState, action: PortalAction, farm: FarmState, replay = false): PortalState {
  ensure(getRole(action.role), '未知演示角色')
  const plots = scopedPlots(farm, state, action.role)
  switch (action.type) {
    case 'request': {
      ensure(action.role === 'farmer' || action.role === 'cooperative', '仅委托方可申请服务')
      const plot = plots.find(p => p.id === action.job.plotId)
      ensure(plot && positive(action.job.area) && action.job.area <= plot.area, '作业面积不得超过授权地块面积')
      ensure(['machine', 'team', 'protection'].includes(action.job.provider) && action.job.operation.trim() && dateValid(action.job.date), '请完善服务类型与预约日期')
      ensure(!state.services.some(j => j.id === action.job.id), '服务编号重复')
      return { ...state, services: [{ ...action.job, requester: action.role, status: '待接单' }, ...state.services] }
    }
    case 'serviceStatus': {
      const job = state.services.find(j => j.id === action.id)
      ensure(job, '订单不存在')
      const next = ({ '待接单': '已接单', '已接单': '作业中', '作业中': '待验收' } as Record<string, string>)[job.status]
      const provider = action.role === job.provider && action.status === next
      const confirm = action.role === job.requester && job.status === '待验收' && action.status === '已完成'
      const cancel = action.role === job.requester && ['待接单', '已接单'].includes(job.status) && action.status === '已取消'
      ensure(provider || confirm || cancel, '无权执行此状态变更，或订单进度已过期')
      // Switching a business role does not create an independent person. Old journals
      // without account provenance may replay, but cannot authorize a new acceptance.
      if (confirm && !replay) ensure(action.accountId && job.performedByAccountId && action.accountId !== job.performedByAccountId, '需要有独立账号的授权验收人；执行人切换身份也不能自验收')
      ensure(action.status !== '待验收' || (action.completion?.trim().length ?? 0) >= 5, '完工说明至少5个字')
      ensure(action.status !== '待验收' || job.provider !== 'protection' || state.protection.some(p => p.jobId === job.id), '植保完工前请补齐药剂、用量和安全间隔记录')
      return { ...state, services: state.services.map(j => j.id === job.id ? { ...j, status: action.status, completion: action.completion || j.completion, performedByAccountId: provider ? (j.performedByAccountId || action.accountId) : j.performedByAccountId, acceptedByAccountId: confirm ? action.accountId : j.acceptedByAccountId } : j) }
    }
    case 'offer': {
      const plot = plots.find(p => p.id === action.offer.plotId)
      ensure(plot && (replay || (!plot.forecastPending && plot.version === action.offer.version)), '地块无权发布或种植档案待重新核实')
      ensure(positive(action.offer.quantity) && action.offer.quantity <= plot.availableKg && positive(action.offer.price), '供货数量需在可供量内，意向价须为正数')
      // Project only public fields from the authoritative plot, never persist private farmer/record data here.
      const offer: Offer = replay ? action.offer : { plotId: plot.id, crop: plot.crop, town: plot.town, area: plot.area, harvest: plot.harvest, quantity: action.offer.quantity, price: action.offer.price, version: plot.version, status: '已发布' }
      return { ...state, offers: [offer, ...state.offers.filter(o => o.plotId !== plot.id)] }
    }
    case 'withdraw':
      ensure(plots.some(p => p.id === action.plotId), '无权撤回该地块货源')
      return { ...state, offers: state.offers.map(o => o.plotId === action.plotId ? { ...o, status: '已撤回' } : o) }
    case 'demand':
      ensure(action.role === 'buyer' || action.role === 'processor', '无权发布采购需求')
      ensure(action.demand.product.trim() && ['A级', 'B级', 'C级', '不限'].includes(action.demand.grade) && positive(action.demand.quantity) && dateValid(action.demand.date), '请填写有效的产品、等级、数量和到货日期')
      ensure(!state.demands.some(d => d.id === action.demand.id), '需求编号重复')
      return { ...state, demands: [{ ...action.demand, actor: action.role, status: '征集中' }, ...state.demands] }
    case 'closeDemand':
      ensure(state.demands.some(d => d.id === action.id && d.actor === action.role && d.status === '征集中'), '只能关闭本主体征集中的需求')
      return { ...state, demands: state.demands.map(d => d.id === action.id ? { ...d, status: '已关闭' } : d) }
    case 'sale': {
      ensure(action.role === 'supplier', '仅农资门店可登记销售凭据')
      ensure(action.consent === true, '需农户确认本次销售凭据关联授权')
      const card = farm.cards.find(c => c.id === action.sale.cardId && (replay || c.status === '已激活'))
      ensure(card && card.farmer === action.sale.customer, '卡片无效、挂失或农户不匹配')
      ensure(action.sale.product.trim() && action.sale.batch.trim() && action.sale.unit.trim() && positive(action.sale.quantity) && positive(action.sale.amount), '请完善商品批次、数量、单位与实付金额')
      ensure(!state.sales.some(s => s.id === action.sale.id), '凭据编号重复')
      return { ...state, sales: [action.sale, ...state.sales] }
    }
    case 'protection': {
      const job = state.services.find(j => j.id === action.entry.jobId)
      const e = action.entry
      ensure(action.role === 'protection' && job?.provider === 'protection' && job.status === '作业中', '只能记录本团队正在执行的植保委托')
      ensure(e.product.trim() && e.batch.trim() && e.unit.trim() && positive(e.amount) && positive(e.area) && e.area <= job.area, '需药剂批次、有效用量、单位及不超委托面积的作业面积')
      ensure(Number.isInteger(e.safetyDays) && e.safetyDays >= 0 && e.safetyDays <= 365 && e.note.trim().length >= 5 && action.confirmed === true, '请按登记标签与农技指导核对安全间隔并填写至少5字说明')
      ensure(!state.protection.some(p => p.id === e.id), '植保记录编号重复')
      return { ...state, protection: [e, ...state.protection] }
    }
    case 'sample':
      ensure(action.role === 'lab' && state.samples.some(s => s.id === action.id && s.status === '待采样'), '只能处理本机构待采样委托')
      return { ...state, samples: state.samples.map(s => s.id === action.id ? { ...s, status: '已采样' } : s) }
    case 'report':
      ensure(action.role === 'lab' && state.samples.some(s => s.id === action.id && s.status === '已采样'), '请先完成受托采样；已提交报告不能覆盖')
      ensure(Number.isFinite(action.ph) && action.ph >= 0 && action.ph <= 14 && Number.isFinite(action.organic) && action.organic >= 0 && action.organic <= 1000, 'pH须为0–14，有机质须为有效非负数')
      ensure(action.reportNo.trim() && action.advice.trim().length >= 5 && action.evidence.endsWith('.pdf'), '需报告编号、至少5个字的建议和PDF报告元数据')
      ensure(!state.samples.some(s => s.reportNo === action.reportNo), '报告编号重复')
      return { ...state, samples: state.samples.map(s => s.id === action.id ? { ...s, ph: action.ph, organic: action.organic, advice: action.advice, reportNo: action.reportNo, evidence: action.evidence, status: '待运营核验' } : s) }
    case 'process': {
      ensure(action.role === 'processor', '仅分拣主体可登记分级')
      const entry = action.entry
      const batch = scopedBatches(farm, action.role).find(b => b.id === entry.batchId)
      const used = state.processing.filter(e => e.batchId === entry.batchId).reduce((s, e) => s + e.input, 0)
      ensure(batch && positive(entry.input) && (replay || entry.input + used <= batch.quantity - batch.reserved - batch.sold), '分拣投入超过本车间批次未锁定剩余量')
      ensure([entry.a, entry.b, entry.c, entry.loss].every(n => Number.isFinite(n) && n >= 0) && Math.abs(entry.a + entry.b + entry.c + entry.loss - entry.input) < 0.001, 'A级+B级+C级+损耗必须等于投入量')
      ensure(!state.processing.some(e => e.id === entry.id), '分拣编号重复')
      return { ...state, processing: [entry, ...state.processing] }
    }
    case 'cost':
      ensure(action.role === 'farmer' && plots.some(p => p.id === action.plotId), '只能保存自己的成本')
      costEstimate(action.input)
      return { ...state, costs: { ...state.costs, [action.plotId]: action.input } }
    case 'family':
      ensure(action.role === 'farmer', '授权由种植户本人管理；子女不能自行提权')
      ensure(Object.values(action.permissions).length === 3 && Object.values(action.permissions).every(v => typeof v === 'boolean'), '授权参数无效')
      ensure(action.permissions.view || (!action.permissions.configure && !action.permissions.stories), '请先授权查看，再授权代办')
      return { ...state, family: action.permissions }
    case 'story':
      ensure(action.role === 'family' && state.family.view && state.family.stories, '尚未获准整理记录草稿')
      ensure(action.text.trim().length >= 10 && action.text.length <= 2000, '草稿请填写10–2000字')
      ensure(!state.stories.some(s => s.id === action.id), '草稿编号重复')
      return { ...state, stories: [{ id: action.id, text: action.text.trim(), at: action.at }, ...state.stories] }
    case 'asset':
      ensure(state.assets.some(a => a.id === action.id && a.role === action.role) && ['可预约', '作业中', '维护中'].includes(action.status), '无权修改该资源或状态无效')
      return { ...state, assets: state.assets.map(a => a.id === action.id ? { ...a, status: action.status } : a) }
    case 'membership':
      ensure(action.role === 'buyer' && ['年会员', '按条查看'].includes(action.mode), '仅采购商可选择查看方案')
      return { ...state, memberships: { ...state.memberships, mode: action.mode, active: false } }
    case 'unlock':
      ensure(action.role === 'buyer' && state.memberships.mode === '按条查看' && (replay || publicOffers(farm, state).some(o => o.plotId === action.plotId)), '请选择有效货源和按条方案')
      ensure(!state.memberships.unlocked.includes(action.plotId), '该条货源已经模拟解锁')
      return { ...state, memberships: { ...state.memberships, unlocked: [...state.memberships.unlocked, action.plotId] } }
    default: throw new Error('未知业务操作')
  }
}
