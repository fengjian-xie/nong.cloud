import type { FarmState, ProductionPlot } from '../farm/model'
import { available, demoDate } from '../farm/model'

export const valueViews = {
  passport: '产品批次履历', calendar: '采收供货日历', stories: '产季记录',
  income: '经营净收益', grades: '分级货源匹配', history: '跨年经营对比',
  collaboration: '协同与缺项提醒', feedback: '履约反馈',
} as const
export type ValueView = keyof typeof valueViews
export const isValueView = (id?: string): id is ValueView => !!id && Object.prototype.hasOwnProperty.call(valueViews, id)
export const valueModules = Object.keys(valueViews).map(id => `value-${id}`)
export type ValueActor = { accountId: string; role: string; plotIds: string[]; publicPlotIds?: string[]; processedKg?: Record<string, number>; canReview: boolean; canStory: boolean }
export type Passport = { plotId: string; batchId: string; version: number; author: string; contributors: string[]; consent: boolean; status: '草稿' | '待独立审核' | '演示已发布' | '已撤回'; note: string }
export type WindowDraft = { plotId: string; start: string; end: string; minKg: number; maxKg: number; source: string; version: number; updatedAt?: string }
export type Story = { id: string; plotId: string; text: string; evidenceIds: string[]; mediaConfirmed: boolean; status: '待本人确认草稿'; at: string }
export type Followup = { id: string; kind: '询价' | '分级需求' | '跟进' | '反馈'; target: string; text: string; at: string; accountId: string; role: string }
export type IncomeInput = { revenue: string; materials: string; services: string; other: string; packaging: string; coldChain: string; delivery: string; afterSale: string; card: string; laborDays: string; dayRate: string; quantityKg: string }
export type ValueState = { version: 1; owner: string; passports: Passport[]; windows: WindowDraft[]; stories: Story[]; subscriptions: string[]; followups: Followup[]; income: Record<string, IncomeInput>; audit: { at: string; action: string; target: string; role?: string }[] }
export const valueKey = (accountId: string) => `xiangqiao:work-demo:value:${encodeURIComponent(accountId)}`
export const seedIncome: IncomeInput = { revenue: '0', materials: '0', services: '0', other: '0', packaging: '0', coldChain: '0', delivery: '0', afterSale: '0', card: '100', laborDays: '0', dayRate: '180', quantityKg: '0' }
const growers = ['farmer', 'cooperative']
const publicReaders = ['buyer', 'warehouse', 'processor', 'consumer']
export function seedValueState(owner: string, farm: FarmState): ValueState {
  return { version: 1, owner, passports: farm.plots.map(p => ({ plotId: p.id, batchId: `HV-${p.id}-2026-01`, version: p.version, author: 'demo-other-editor', contributors: ['demo-other-editor'], consent: false, status: '草稿', note: '采收批次与实物对应待核对；本示例不是实际采收证明。' })), windows: [], stories: [], subscriptions: [], followups: [], income: {}, audit: [] }
}
export const dateValid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s
function requireRule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message) }
function text(value: string, min = 4, max = 1000) { requireRule(typeof value === 'string' && value.trim().length >= min && value.length <= max, `请填写${min}–${max}字的说明`) }
function assertOwn(actor: ValueActor, plotId: string) { requireRule(actor.plotIds.includes(plotId), '不在当前身份授权地块范围内') }
export function verifiedEvents(farm: FarmState, plot: ProductionPlot) {
  return farm.records.filter(r => (r.review?.plotId || r.plotId) === plot.id && r.farmer === plot.owner && r.synced && r.status === '已核验')
}
export function publicSummary(farm: FarmState, passport: Passport) {
  const plot = farm.plots.find(p => p.id === passport.plotId)
  requireRule(plot, '关联地块不存在')
  const events = verifiedEvents(farm, plot)
  // Deliberate allowlist: never spread private plot, device, cost, delegation or raw coordinates.
  return { mode: '公开摘要演示', batchId: passport.batchId, product: plot.crop, region: '福建·福安', season: plot.season, revision: passport.version,
    status: passport.version === plot.version && !plot.forecastPending ? passport.status : '地块版本变化，待复核',
    harvest: `${plot.harvest}（预计，非实收）`, operator: '经授权的种植主体（示例匿名）',
    events: events.map(r => ({ day: r.at.slice(0, 10), operation: r.operation, source: '平台核验（演示）' })),
    soil: farm.soils.some(s => s.plotId === plot.id && s.status === '已归档') ? '土壤报告已归档（示例），不是产品安全检测' : '土壤报告待核验',
    productTest: '暂无适用的真实产品检测报告', handover: '采收、分级和交接待实物确认', mixedBatch: '混装必须另建混合批并关联全部来源；本批不自动继承其他批次记录',
  }
}
export function generateStory(farm: FarmState, plotId: string) {
  const plot = farm.plots.find(p => p.id === plotId)
  requireRule(plot, '地块不存在')
  const events = verifiedEvents(farm, plot)
  requireRule(events.length, '暂无已同步且已核验的对应农事记录，不能生成生产经历')
  return { text: `这一季的${plot.crop}（示例）\n${events.map(r => `${r.at.slice(0, 10)}：留下了“${r.operation}”的核验记录（演示）。`).join('\n')}\n采收、产品检测与交付尚待确认。本文是记录摘要草稿，不作品质或认证承诺。`, evidenceIds: events.map(r => r.id) }
}
export function amount(value: string, allowZero = true) {
  requireRule(typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value), '请填完整的非负数字，最多两位小数；空白不是零')
  const n = Number(value); requireRule(Number.isFinite(n) && n <= 100000000 && (allowZero || n > 0), '数值超出范围或数量不是正数')
  return n
}
export function incomeEstimate(input: IncomeInput) {
  const cents = (key: keyof IncomeInput) => Math.round(amount(input[key]) * 100)
  const revenue = cents('revenue')
  const cash = (['materials', 'services', 'other', 'packaging', 'coldChain', 'delivery', 'afterSale', 'card'] as const).reduce((s, k) => s + cents(k), 0)
  const labor = Math.round(amount(input.laborDays) * cents('dayRate'))
  const full = cash + labor, quantity = amount(input.quantityKg, false)
  requireRule([revenue, cash, labor, full, Math.round(full / quantity * 1.35)].every(Number.isSafeInteger), '超过安全金额范围，请缩小统计范围')
  return { revenue: revenue / 100, cash: cash / 100, full: full / 100, labor: labor / 100, cashNet: (revenue - cash) / 100, fullNet: (revenue - full) / 100, unit: full / 100 / quantity, reference: full / 100 / quantity * 1.35 }
}
export function gradeMatches(farm: FarmState, product: string, grade: string, quantity: string, unit: string, processed: Record<string, number> = {}) {
  requireRule(['kg', '斤'].includes(unit) && ['A级', 'B级', 'C级'].includes(grade), '请选择有效的单位和等级')
  const kg = amount(quantity, false) * (unit === '斤' ? .5 : 1)
  requireRule(product.trim(), '请填写产品关键词')
  const usable = (b: FarmState['batches'][number]) => available(b) - (processed[b.id] || 0)
  requireRule(Object.values(processed).every(v => Number.isFinite(v) && v >= 0), '分拣占用量待核对')
  return { kg, rows: farm.batches.filter(b => b.product.includes(product.trim()) && b.grade === grade && b.origin === '共享库存' && dateValid(b.expires) && b.expires >= demoDate && usable(b) >= kg).map(b => ({ batchId: b.id, product: b.product, grade: b.grade, availableKg: usable(b), expires: b.expires, scope: '共享库存意向，质量及货主授权待确认' })) }
}
export function reminders(farm: FarmState, plotIds: string[]) {
  return farm.plots.filter(p => plotIds.includes(p.id)).flatMap(p => [
    ...farm.records.filter(r => (r.review?.plotId || r.plotId) === p.id && r.status === '待核验').map(r => ({ id: `record:${r.id}`, plotId: p.id, title: '农事记录待核验', detail: `${r.operation} · 不根据按钮推断作业质量` })),
    ...(!farm.soils.some(s => s.plotId === p.id && s.status === '已归档') ? [{ id: `soil:${p.id}`, plotId: p.id, title: '土壤报告待核验', detail: '专业建议须由适当人员确认，系统不生成药量或处方' }] : []),
    ...(!verifiedEvents(farm, p).length ? [{ id: `evidence:${p.id}`, plotId: p.id, title: '产品履历证据缺项', detail: '缺少已同步、归属一致的核验事件；记录多不等于品质高' }] : []),
    ...(p.forecastPending ? [{ id: `forecast:${p.id}`, plotId: p.id, title: '成熟预测待复核', detail: '种植变更后不能沿用旧预测或供货承诺' }] : []),
  ])
}
export type ValueCommand =
  | { type: 'review.example'; plotId: string }
  | { type: 'passport.save'; plotId: string; consent: boolean; note: string }
  | { type: 'passport.submit' | 'passport.approve' | 'passport.withdraw'; plotId: string }
  | { type: 'window'; draft: WindowDraft }
  | { type: 'subscribe'; plotId: string }
  | { type: 'story'; plotId: string; text: string; evidenceIds: string[]; mediaConfirmed: boolean }
  | { type: 'income'; plotId: string; input: IncomeInput }
  | { type: 'followup'; kind: Followup['kind']; target: string; text: string }

export function reduceValue(state: ValueState, action: ValueCommand, actor: ValueActor, farm: FarmState, at: string, id: string): ValueState {
  requireRule(state.owner === actor.accountId, '账号上下文已改变，不能写入其他账号草稿')
  requireRule(state.audit.length < 500 && !state.followups.some(f => f.id === id) && !state.stories.some(s => s.id === id), '本机记录已满或请求重复，请使用新的演示操作')
  const next: ValueState = JSON.parse(JSON.stringify(state))
  let target = ''
  if (action.type === 'review.example') {
    target = action.plotId; assertOwn(actor, target)
    requireRule(actor.canReview, '只有审核岗位可载入核验示例')
    const p = next.passports.find(p => p.plotId === target), plot = farm.plots.find(p => p.id === target)
    requireRule(p && plot && p.status === '草稿' && !p.contributors.includes(actor.accountId), '不能用示例覆盖自己编辑的稿件或已处理版本')
    requireRule(verifiedEvents(farm, plot).length && !plot.forecastPending, '示例也须有有效的核验事件')
    Object.assign(p, { consent: true, status: '待独立审核', version: plot.version, author: 'demo-other-editor', contributors: ['demo-other-editor'], note: '其他示例编辑提交的核验流程草稿，非真实公开授权或采收证明。' })
  } else if (action.type.startsWith('passport.')) {
    const a = action as Extract<ValueCommand, { plotId: string }>; target = a.plotId; assertOwn(actor, a.plotId)
    const p = next.passports.find(p => p.plotId === a.plotId), plot = farm.plots.find(p => p.id === a.plotId)
    requireRule(p && plot, '批次不存在')
    if (action.type === 'passport.save') {
      requireRule(actor.canReview || growers.includes(actor.role), '当前身份不能编辑产品履历')
      requireRule(p.status === '草稿' || p.status === '已撤回', '先撤回，再编辑；待审核或已发布版本不能覆盖')
      text(action.note, 8, 500); Object.assign(p, { author: actor.accountId, contributors: [...new Set([...p.contributors, actor.accountId])], consent: action.consent, note: action.note.trim(), version: plot.version, status: '草稿' })
    } else if (action.type === 'passport.submit') {
      requireRule(actor.canReview || growers.includes(actor.role), '当前身份不能提交产品履历')
      requireRule(p.consent && (p.status === '草稿' || p.status === '已撤回'), '须确认摘要公开范围；草稿才能提交')
      requireRule(p.version === plot.version && !plot.forecastPending && verifiedEvents(farm, plot).length, '版本或农事证据待确认，不能提交')
      p.status = '待独立审核'
    } else if (action.type === 'passport.approve') {
      requireRule(actor.canReview && p.status === '待独立审核', '只有运营审核岗位可处理待审核稿')
      requireRule(p.author !== actor.accountId && !p.contributors.includes(actor.accountId), '同一账号不能审核自己参与编辑的履历，切换身份也不例外')
      requireRule(p.consent && p.version === plot.version && !plot.forecastPending && verifiedEvents(farm, plot).length, '授权、版本或证据失效，请重新提交')
      p.status = '演示已发布'
    } else {
      requireRule(actor.canReview || growers.includes(actor.role), '当前身份不能撤回履历')
      p.status = '已撤回'
    }
  } else if (action.type === 'window') {
    const d = action.draft; target = d.plotId; assertOwn(actor, d.plotId)
    requireRule(actor.canReview || growers.includes(actor.role), '当前身份不能调整供货预测')
    const plot = farm.plots.find(p => p.id === d.plotId)
    requireRule(plot && d.version === plot.version && !plot.forecastPending, '产季版本变化或预测待复核')
    requireRule(dateValid(d.start) && dateValid(d.end) && d.start <= d.end, '成熟窗口起止日期无效')
    requireRule(Number.isFinite(d.minKg) && Number.isFinite(d.maxKg) && d.minKg >= 0 && d.maxKg >= d.minKg && d.maxKg <= plot.yieldKg, '可供量区间不合理或超过本季预测产量')
    text(d.source, 8, 240); next.windows = [...next.windows.filter(w => w.plotId !== d.plotId), { ...d, source: d.source.trim(), updatedAt: at }]
  } else if (action.type === 'subscribe') {
    target = action.plotId; requireRule(farm.plots.some(p => p.id === action.plotId) && (actor.publicPlotIds?.includes(action.plotId) || actor.plotIds.includes(action.plotId) || actor.canReview), '此身份无可关注的供货摘要')
    next.subscriptions = next.subscriptions.includes(target) ? next.subscriptions.filter(p => p !== target) : [...next.subscriptions, target]
  } else if (action.type === 'story') {
    target = action.plotId; assertOwn(actor, action.plotId)
    requireRule(actor.canStory && ['farmer', 'cooperative', 'family', 'admin'].includes(actor.role), '未获记录整理授权')
    text(action.text, 10, 2000); requireRule(action.mediaConfirmed, '先核对内容与媒体授权；不会替农户自动公开')
    const plot = farm.plots.find(p => p.id === target)
    requireRule(plot && action.evidenceIds.length && action.evidenceIds.every(id => verifiedEvents(farm, plot).some(r => r.id === id)), '关联证据已改变或尚未核验，请重新生成')
    next.stories.unshift({ id, plotId: target, text: action.text.trim(), evidenceIds: [...action.evidenceIds], mediaConfirmed: true, status: '待本人确认草稿', at })
  } else if (action.type === 'income') {
    target = action.plotId; assertOwn(actor, target); requireRule(actor.canReview || growers.includes(actor.role), '采购或服务身份不能读取和保存农户经营账')
    incomeEstimate(action.input); next.income[target] = { ...action.input }
  } else if (action.type === 'followup') {
    requireRule(['询价', '分级需求', '跟进', '反馈'].includes(action.kind), '未知跟进类别')
    target = action.target; text(action.text, 8, 600); text(target, 2, 100)
    if (action.kind === '询价') requireRule(publicReaders.includes(actor.role) && actor.publicPlotIds?.includes(target) && farm.plots.some(p => p.id === target), '只有授权供货摘要可留询价意向')
    if (action.kind === '分级需求') requireRule(['buyer', 'processor', 'cooperative', 'admin'].includes(actor.role), '当前身份不能登记分级补货需求')
    if (action.kind === '跟进') requireRule(reminders(farm, actor.plotIds).some(r => r.id === target) || ['team', 'machine', 'protection', 'admin'].includes(actor.role), '当前身份不能跟进此事项')
    if (action.kind === '反馈') requireRule(['buyer', 'consumer', 'farmer', 'cooperative', 'admin'].includes(actor.role), '当前身份无产品履约反馈入口')
    next.followups.unshift({ id, kind: action.kind, target, text: action.text.trim(), at, accountId: actor.accountId, role: actor.role })
  } else { throw new Error('未知产品价值操作') }
  next.audit.unshift({ at, action: action.type, target, role: actor.role }); return next
}

export function restoreValue(raw: string | null, owner: string, farm: FarmState): ValueState {
  const fallback = () => seedValueState(owner, farm)
  try {
    if (!raw) return fallback()
    const s = JSON.parse(raw) as ValueState
    requireRule(s.version === 1 && s.owner === owner, '缓存范围不匹配')
    requireRule(['passports', 'windows', 'stories', 'subscriptions', 'followups', 'audit'].every(k => Array.isArray(s[k as keyof ValueState]) && (s[k as keyof ValueState] as unknown[]).length <= 500), '缓存格式错误')
    requireRule(s.passports.length === farm.plots.length && new Set(s.passports.map(p => p.plotId)).size === s.passports.length && s.passports.every(p => farm.plots.some(f => f.id === p.plotId) && p.batchId === `HV-${p.plotId}-2026-01` && Number.isInteger(p.version) && p.version > 0 && typeof p.author === 'string' && Array.isArray(p.contributors) && p.contributors.every(x => typeof x === 'string') && typeof p.consent === 'boolean' && ['草稿', '待独立审核', '演示已发布', '已撤回'].includes(p.status) && typeof p.note === 'string' && p.note.length <= 500), '履历格式错误')
    requireRule(s.windows.every(w => farm.plots.some(p => p.id === w.plotId) && dateValid(w.start) && dateValid(w.end) && w.start <= w.end && Number.isFinite(w.minKg) && Number.isFinite(w.maxKg) && w.minKg >= 0 && w.minKg <= w.maxKg && typeof w.source === 'string' && Number.isInteger(w.version)), '窗口格式错误')
    requireRule(s.stories.every(x => typeof x.id === 'string' && typeof x.plotId === 'string' && typeof x.text === 'string' && x.text.length <= 2000 && Array.isArray(x.evidenceIds) && x.evidenceIds.every(i => typeof i === 'string') && x.mediaConfirmed === true && x.status === '待本人确认草稿' && typeof x.at === 'string'), '记录格式错误')
    requireRule(s.subscriptions.every(x => typeof x === 'string') && s.followups.every(f => typeof f.id === 'string' && typeof f.target === 'string' && typeof f.text === 'string' && f.text.length <= 600 && typeof f.at === 'string' && f.accountId === owner && ['询价', '分级需求', '跟进', '反馈'].includes(f.kind) && typeof f.role === 'string'), '跟进格式错误')
    requireRule(s.income && typeof s.income === 'object' && !Array.isArray(s.income) && Object.entries(s.income).every(([id, input]) => farm.plots.some(p => p.id === id) && !!incomeEstimate(input)), '经营账格式错误')
    requireRule(s.audit.every(a => typeof a.at === 'string' && typeof a.action === 'string' && typeof a.target === 'string'), '留痕格式错误')
    return s
  } catch { return fallback() }
}

// Public consumers see a separate, minimal fixture. Never read a private account's cache.
export const publicPassportDemo = {
  mode: '公开摘要示例 · 非真实产品承诺', batchId: 'HV-SZT-001-2026-01', product: '福安葡萄（示例）', region: '福建·福安', season: '2026产季示例', revision: 1,
  status: '公开展示原型', harvest: '成熟与实收待确认', operator: '种植主体待核验（匿名示例）',
  events: [{ day: '产季示例阶段', operation: '修剪记录', source: '原始记录→核验→公开摘要，尚未接入真实数据' }],
  soil: '机构报告与建议待接入', productTest: '暂无适用的真实产品检测报告', handover: '采收、分级、交接和配送待确认', mixedBatch: '混合批需关联全部来源，不套用单户记录',
}
