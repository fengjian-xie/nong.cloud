import { describe, expect, it } from 'vitest'
import { createFarmSeed } from '../farm/model'
import { getRole, roles } from './config'
import { createPortalSeed, publicOffers, reducePortal, scopedBatches, scopedJobs, scopedPlots } from './model'
import type { PortalAction, PortalCommand, PortalState } from './model'
import type { RoleId } from './config'

const farm = createFarmSeed()
const act = (state: PortalState, role: RoleId, command: PortalCommand) => reducePortal(state, { ...command, role, accountId: `independent-test:${role}`, at: '2026-08-29 10:00', eventId: 'TEST' } as PortalAction, farm)
describe('多角色共用底座与业务边界', () => {
  it('同一账号切换为委托方也不得自验收，旧订单缺少执行账号须补核验', () => {
    let state = createPortalSeed()
    const action = (role: RoleId, status: '已接单' | '作业中' | '待验收' | '已完成', accountId: string) => ({type:'serviceStatus',id:'SRV-001',role,status,accountId,completion:'按现场约定完成作业',eventId:'actor-check',at:'2026-10-06'} as PortalAction)
    for (const status of ['已接单','作业中','待验收'] as const) state = reducePortal(state,action('team',status,'same-account'),farm)
    expect(() => reducePortal(state,action('farmer','已完成','same-account'),farm)).toThrow('独立账号')
    expect(reducePortal(state,action('farmer','已完成','independent-reviewer'),farm).services[0].acceptedByAccountId).toBe('independent-reviewer')
    const legacy = {...state, services:state.services.map(j=>({...j,performedByAccountId:undefined}))}
    expect(() => reducePortal(legacy,action('farmer','已完成','independent-reviewer'),farm)).toThrow('独立账号')
  })
  it('11种角色有唯一入口，植保复用服务并保留专业模块', () => {
    expect(new Set(roles.map(r => r.id)).size).toBe(11)
    expect(getRole('protection')?.modules).toEqual(['services', 'protection', 'assets', 'value-collaboration'])
    expect(getRole('invalid')).toBeUndefined()
  })
  it('种植户、合作社只获取授权地块，撤销家庭查看后不返回档案', () => {
    const seed = createPortalSeed()
    expect(scopedPlots(farm, seed, 'farmer').map(p => p.id)).toEqual(['SZT-001'])
    expect(scopedPlots(farm, seed, 'cooperative')).toHaveLength(3)
    expect(scopedPlots(farm, seed, 'buyer')).toEqual([])
    const revoked = act(seed, 'farmer', { type: 'family', permissions: { view: false, configure: false, stories: false } })
    expect(scopedPlots(farm, revoked, 'family')).toEqual([])
  })
  it('库存按货权、保管权与主动共享区分，不能暴露自营私有货源', () => {
    expect(scopedBatches(farm, 'warehouse').map(b => b.id)).toEqual(['BATCH-001', 'BATCH-002'])
    expect(scopedBatches(farm, 'processor').map(b => b.id)).toEqual(['BATCH-001'])
    expect(scopedBatches(farm, 'buyer').map(b => b.id)).toEqual(['BATCH-001', 'BATCH-003'])
  })
  it('服务单仅委托方或被指派提供方可见，提供方不能自验收', () => {
    let state = createPortalSeed()
    expect(scopedJobs(state, 'machine').map(j => j.id)).toEqual(['SRV-002'])
    expect(() => act(state, 'machine', { type: 'serviceStatus', id: 'SRV-001', status: '已接单' })).toThrow('无权')
    state = act(state, 'team', { type: 'serviceStatus', id: 'SRV-001', status: '已接单' })
    state = act(state, 'team', { type: 'serviceStatus', id: 'SRV-001', status: '作业中' })
    expect(() => act(state, 'team', { type: 'serviceStatus', id: 'SRV-001', status: '待验收', completion: '完成' })).toThrow('至少5')
    state = act(state, 'team', { type: 'serviceStatus', id: 'SRV-001', status: '待验收', completion: '按委托内容完成修剪' })
    expect(() => act(state, 'team', { type: 'serviceStatus', id: 'SRV-001', status: '已完成' })).toThrow('无权')
    expect(() => act(state, 'cooperative', { type: 'serviceStatus', id: 'SRV-001', status: '已完成' })).toThrow('无权')
    state = act(state, 'farmer', { type: 'serviceStatus', id: 'SRV-001', status: '已完成' })
    expect(state.services.find(j => j.id === 'SRV-001')?.status).toBe('已完成')
    expect(() => act(state, 'farmer', { type: 'serviceStatus', id: 'SRV-001', status: '已完成' })).toThrow('过期')
  })
  it('申请服务不得越过地块归属和面积，取消后不能接单', () => {
    const seed = createPortalSeed()
    const job = { id: 'TEST', plotId: 'SZT-001', provider: 'team' as const, area: 13, date: '2026-09-01', operation: '修剪', note: '' }
    expect(() => act(seed, 'farmer', { type: 'request', job })).toThrow('面积')
    expect(() => act(seed, 'buyer', { type: 'request', job })).toThrow('委托方')
    expect(() => act(seed, 'farmer', { type: 'request', job: { ...job, plotId: 'SZT-002', area: 1 } })).toThrow('授权')
    const cancelled = act(seed, 'farmer', { type: 'serviceStatus', id: 'SRV-001', status: '已取消' })
    expect(() => act(cancelled, 'team', { type: 'serviceStatus', id: 'SRV-001', status: '已接单' })).toThrow('无权')
  })
  it('植保未记录药剂、安全间隔和专业核对前不得提交完工', () => {
    let state = act(createPortalSeed(), 'protection', { type: 'serviceStatus', id: 'SRV-003', status: '作业中' })
    expect(() => act(state, 'protection', { type: 'serviceStatus', id: 'SRV-003', status: '待验收', completion: '现场植保已完成' })).toThrow('补齐')
    const entry = { id: 'P1', jobId: 'SRV-003', product: '演示药剂（非建议）', batch: 'DEMO', amount: 1, unit: 'L', area: 12, safetyDays: 7, note: '专业人员按标签核对', at: '2026-08-29' }
    expect(() => act(state, 'protection', { type: 'protection', entry, confirmed: false })).toThrow('核对')
    expect(() => act(state, 'team', { type: 'protection', entry, confirmed: true })).toThrow('本团队')
    state = act(state, 'protection', { type: 'protection', entry, confirmed: true })
    state = act(state, 'protection', { type: 'serviceStatus', id: 'SRV-003', status: '待验收', completion: '现场植保已完成' })
    expect(state.services.find(j => j.id === 'SRV-003')?.status).toBe('待验收')
  })
  it('供货只投影公开字段，种植版本变更后自动停止展示', () => {
    const seed = createPortalSeed()
    expect(Object.keys(publicOffers(farm, seed)[0])).not.toContain('owner')
    expect(publicOffers({ ...farm, plots: farm.plots.map(p => p.id === 'SZT-001' ? { ...p, version: 2 } : p) }, seed)).toEqual([])
    expect(publicOffers({ ...farm, plots: farm.plots.map(p => ({ ...p, forecastPending: true })) }, seed)).toEqual([])
    expect(() => act(seed, 'buyer', { type: 'withdraw', plotId: 'SZT-001' })).toThrow('无权')
    const withdrawn = act(seed, 'farmer', { type: 'withdraw', plotId: 'SZT-001' })
    expect(publicOffers(farm, withdrawn)).toEqual([])
  })
  it('采购需求可关闭但只能关闭本主体需求；数量无效不写入', () => {
    const seed = createPortalSeed()
    expect(() => act(seed, 'buyer', { type: 'closeDemand', id: 'DEMAND-001' })).toThrow('本主体')
    const demand = { id: 'D2', product: '葡萄', grade: 'B级', quantity: NaN, date: '2026-09-01', note: '' }
    expect(() => act(seed, 'processor', { type: 'demand', demand })).toThrow('有效')
    expect(act(seed, 'processor', { type: 'closeDemand', id: 'DEMAND-001' }).demands[0].status).toBe('已关闭')
  })
  it('农资凭据须得到本次关联授权，挂失卡不能新增销售，销售不改农事记录', () => {
    const seed = createPortalSeed()
    const sale = { id: 'S1', cardId: 'XQ-C0001', customer: '林春梅', product: '演示肥料', batch: 'DEMO', quantity: 2, unit: '袋', amount: 160, at: '2026-08-29' }
    expect(() => act(seed, 'supplier', { type: 'sale', sale, consent: false })).toThrow('授权')
    expect(() => act(seed, 'supplier', { type: 'sale', sale: { ...sale, customer: '其他人' }, consent: true })).toThrow('不匹配')
    const lostFarm = { ...farm, cards: farm.cards.map(c => c.id === 'XQ-C0001' ? { ...c, status: '已挂失' as const } : c) }
    const action = { type: 'sale' as const, role: 'supplier' as const, sale, consent: true, eventId: 'E', at: '2026-08-29' }
    expect(() => reducePortal(seed, action, lostFarm)).toThrow('挂失')
    expect(reducePortal(seed, action, lostFarm, true).sales).toHaveLength(1)
    expect(act(seed, 'supplier', { type: 'sale', sale, consent: true }).sales).toHaveLength(1)
    expect(farm.records).toEqual(createFarmSeed().records)
  })
  it('分级质量平衡与累计量有约束，不能处理其他货主或锁定数量', () => {
    const seed = createPortalSeed()
    const entry = { id: 'P1', batchId: 'BATCH-001', input: 1000, a: 0, b: 900, c: 70, loss: 30, at: '2026-08-29' }
    expect(() => act(seed, 'processor', { type: 'process', entry: { ...entry, b: 901 } })).toThrow('必须等于')
    expect(() => act(seed, 'processor', { type: 'process', entry: { ...entry, batchId: 'BATCH-002' } })).toThrow('本车间')
    const processed = act(seed, 'processor', { type: 'process', entry })
    expect(() => act(processed, 'processor', { type: 'process', entry: { ...entry, id: 'P2' } })).toThrow('剩余量')
    const locked = { ...farm, batches: farm.batches.map(b => ({ ...b, reserved: 1000 })) }
    expect(() => reducePortal(seed, { type: 'process', entry, role: 'processor', at: '', eventId: '' }, locked)).toThrow('剩余量')
  })
  it('报告必须先采样、无效pH不保存、提交后不能覆盖报告或自行核验', () => {
    let state = createPortalSeed()
    const report = { type: 'report' as const, id: 'SAMPLE-001', ph: 6.2, organic: 20, advice: '请由专业人员现场复核', reportNo: 'DEMO1', evidence: 'demo.pdf' }
    expect(() => act(state, 'lab', report)).toThrow('采样')
    state = act(state, 'lab', { type: 'sample', id: 'SAMPLE-001' })
    expect(() => act(state, 'lab', { ...report, ph: 15 })).toThrow('pH')
    state = act(state, 'lab', report)
    expect(state.samples[0].status).toBe('待运营核验')
    expect(() => act(state, 'lab', report)).toThrow('不能覆盖')
    expect(() => act(state, 'farmer', { ...report, id: 'SAMPLE-002' })).toThrow('受托')
  })
  it('子女不能自行提权，未授权不能写记录，成本不能由采购商读取修改', () => {
    const seed = createPortalSeed()
    expect(() => act(seed, 'family', { type: 'family', permissions: { view: true, configure: true, stories: true } })).toThrow('提权')
    expect(() => act(seed, 'family', { type: 'story', id: 'S1', text: '这是一份产季记录草稿内容', at: '' })).toThrow('获准')
    expect(() => act(seed, 'buyer', { type: 'cost', plotId: 'SZT-001', input: seed.costs['SZT-001'] })).toThrow('自己的成本')
    const granted = act(seed, 'farmer', { type: 'family', permissions: { view: true, configure: false, stories: true } })
    expect(act(granted, 'family', { type: 'story', id: 'S1', text: '这是一份产季记录草稿内容', at: '' }).stories).toHaveLength(1)
  })
  it('按条权益仅模拟解锁公开条目，切换年方案不自动付款开通', () => {
    let state = act(createPortalSeed(), 'buyer', { type: 'membership', mode: '按条查看' })
    expect(state.memberships.active).toBe(false)
    expect(() => act(state, 'buyer', { type: 'unlock', plotId: 'SZT-002' })).toThrow('有效')
    state = act(state, 'buyer', { type: 'unlock', plotId: 'SZT-001' })
    expect(state.memberships.unlocked).toEqual(['SZT-001'])
    expect(() => act(state, 'buyer', { type: 'unlock', plotId: 'SZT-001' })).toThrow('已经')
    state = act(state, 'buyer', { type: 'membership', mode: '年会员' })
    expect(state.memberships.active).toBe(false)
  })
})
