import { describe, expect, it } from 'vitest'
import { available, costEstimate, createFarmSeed, traceIssues, transition } from './model'
import type { Action, FarmState } from './model'

const meta = { at: '2026-08-29 12:00:00', eventId: 'TEST-EVT' }
const reduce = (state: FarmState, action: Omit<Action, 'at' | 'eventId'>) => transition(state, { ...action, ...meta } as Action)

describe('乡桥农事状态流转', () => {
  it('发布按键版本不立即修改设备版本，旧记录的作业内容保持不变', () => {
    const seed = createFarmSeed()
    const before = JSON.stringify(seed)
    const next = transition(seed, { type: 'configure', id: seed.cards[0].id, keys: ['植保', '除草', '采收'], ...meta })
    expect(next.cards[0].version).toBe(2)
    expect(next.cards[0].deviceVersion).toBe(1)
    expect(next.cards[0].history).toHaveLength(2)
    expect(next.records).toEqual(seed.records)
    expect(JSON.stringify(seed)).toBe(before)
    const synced = transition(next, { type: 'sync', id: seed.cards[0].id, ...meta })
    expect(synced.cards[0].deviceVersion).toBe(2)
  })
  it('未激活和挂失卡不能配置、同步，激活必须有代办授权', () => {
    const seed = createFarmSeed()
    expect(() => transition(seed, { type: 'configure', id: seed.cards[6].id, keys: ['施肥', '灌溉', '修剪'], ...meta })).toThrow('已激活')
    expect(() => transition(seed, { type: 'activate', id: seed.cards[6].id, farmer: '示例农户', delegate: '合作社', consent: false, ...meta })).toThrow('授权')
    const activated = transition(seed, { type: 'activate', id: seed.cards[6].id, farmer: '示例农户', delegate: '合作社', consent: true, ...meta })
    expect(activated.cards[6].status).toBe('已激活')
    const lost = transition(seed, { type: 'cardStatus', id: seed.cards[0].id, status: '已挂失', ...meta })
    expect(() => transition(lost, { type: 'sync', id: seed.cards[0].id, ...meta })).toThrow('已激活')
  })
  it('离线事件必须先同步，核验纠偏不覆盖原始地块、时间和配置', () => {
    const seed = createFarmSeed()
    const action: Action = { type: 'reviewRecord', id: seed.records[1].id, plotId: 'SZT-001', reason: '已经联系农户确认地块', approve: true, ...meta }
    expect(() => transition(seed, action)).toThrow('先同步')
    const synced = transition(seed, { type: 'sync', id: seed.records[1].cardId, ...meta })
    const next = transition(synced, action)
    expect(next.records[1].plotId).toBe(seed.records[1].plotId)
    expect(next.records[1].review?.plotId).toBe('SZT-001')
    expect(next.records[1].at).toBe(seed.records[1].at)
    expect(next.records[1].configVersion).toBe(1)
    expect(() => transition(next, action)).toThrow('已处理')
  })
  it('种植变更必须同时有照片视频，申请阶段不改写档案，通过后留旧版本', () => {
    const seed = createFarmSeed()
    const change = { id: 'CHANGE-1', plotId: 'SZT-001', crop: '夏黑葡萄', reason: '现场确认已经更换种植品种', evidence: [{ name: 'photo.jpg', kind: 'image' as const, size: 2000 }] }
    expect(() => transition(seed, { type: 'cropChange', change, ...meta })).toThrow('照片和视频')
    const pending = transition(seed, { type: 'cropChange', change: { ...change, evidence: [...change.evidence, { name: 'video.mp4', kind: 'video', size: 3000 }] }, ...meta })
    expect(pending.plots[0].crop).toBe(seed.plots[0].crop)
    expect(() => transition(pending, { type: 'cropChange', change, ...meta })).toThrow('已有待审核')
    const approved = transition(pending, { type: 'reviewChange', id: change.id, approve: true, reason: '模拟核对材料完整并确认', ...meta })
    expect(approved.plots[0].crop).toBe('夏黑葡萄')
    expect(approved.plots[0].version).toBe(2)
    expect(approved.plots[0].forecastPending).toBe(true)
    expect(traceIssues(approved, 'SZT-001')).toContain('种植变更后成熟期与产量需重新核实')
    expect(approved.plots[0].archive[0].crop).toBe(seed.plots[0].crop)
    expect(approved.changes[0].status).toBe('已通过')
  })
  it('成熟预测不能在待审变更期间修改，意向供应不能大于产量', () => {
    const seed = createFarmSeed()
    const action: Action = { type: 'forecast', plotId: 'SZT-001', harvest: '2026-09-10', yieldKg: 10000, availableKg: 8000, ...meta }
    expect(() => transition(seed, { ...action, availableKg: 10001 })).toThrow('不能超过总产量')
    const next = transition({ ...seed, plots: seed.plots.map(p => ({ ...p, forecastPending: true })) }, action)
    expect(next.plots[0].harvest).toBe('2026-09-10')
    expect(next.plots[0].forecastPending).toBe(false)
    const pending = { ...seed, changes: [{ id: 'C', plotId: 'SZT-001', crop: '夏黑', reason: '测试种植变更', evidence: [], baseVersion: 1, status: '待审核' as const, at: meta.at }] }
    expect(() => transition(pending, action)).toThrow('先处理待审核')
  })
  it('超售被拒绝，取消释放库存，出库转换数量且不允许重复处理', () => {
    const seed = createFarmSeed()
    const order = { id: 'O-1', batchId: seed.batches[0].id, buyer: '测试加工商', quantity: 1000, price: 5 }
    const reserved = transition(seed, { type: 'reserve', order, ...meta })
    expect(available(reserved.batches[0])).toBe(500)
    expect(() => transition(reserved, { type: 'reserve', order: { ...order, id: 'O-2', quantity: 600 }, ...meta })).toThrow('可用库存')
    const cancelled = transition(reserved, { type: 'orderStatus', id: order.id, status: '已取消', ...meta })
    expect(available(cancelled.batches[0])).toBe(1500)
    const shipped = transition(reserved, { type: 'orderStatus', id: order.id, status: '已出库', ...meta })
    expect(shipped.batches[0].reserved).toBe(0)
    expect(shipped.batches[0].sold).toBe(1000)
    expect(available(shipped.batches[0])).toBe(500)
    expect(() => transition(shipped, { type: 'orderStatus', id: order.id, status: '已出库', ...meta })).toThrow('不能重复')
  })
  it('采购负数量、过期新批次、负单价和大于999元商家方案不能保存', () => {
    const seed = createFarmSeed()
    expect(() => transition(seed, { type: 'purchase', batch: { ...seed.batches[0], quantity: -1 }, ...meta })).toThrow('正数')
    expect(() => transition(seed, { type: 'purchase', batch: { ...seed.batches[0], expires: '2026-08-20' }, ...meta })).toThrow('截止日')
    expect(() => transition(seed, { type: 'reserve', order: { id: 'O-1', batchId: seed.batches[0].id, buyer: '测试商家', quantity: 20, price: -2 }, ...meta })).toThrow('成交单价')
    expect(() => transition(seed, { type: 'merchant', id: seed.merchants[0].id, mode: '年会员', fee: 1000, ...meta })).toThrow('0–999')
  })
  it('成本+35%按加价率计算，零产量、负成本和无穷数给出错误', () => {
    const input = createFarmSeed().cost
    const result = costEstimate(input)
    expect(result.labour).toBe(21600)
    expect(result.full).toBe(48000)
    expect(result.fullPerKg).toBe(3)
    expect(result.referencePrice).toBeCloseTo(4.05)
    expect(() => costEstimate({ ...input, yieldKg: 0 })).toThrow('正数产量')
    expect(() => costEstimate({ ...input, inputs: -5 })).toThrow()
    expect(() => costEstimate({ ...input, days: Infinity })).toThrow()
  })
  it('报送缺项阻断，完成核验后可预检，失败重试沿用同一任务', () => {
    let state = createFarmSeed()
    expect(traceIssues(state, 'SZT-001')).toContain('尚有待核验农事记录')
    expect(() => transition(state, { type: 'trace', plotId: 'SZT-001', ...meta })).toThrow('待核验')
    for (const record of state.records.filter(r => r.plotId === 'SZT-001' && r.status === '待核验')) state = transition(state, { type: 'reviewRecord', id: record.id, plotId: 'SZT-001', approve: true, reason: '现场抽查并联系农户核实', ...meta })
    state = transition(state, { type: 'trace', plotId: 'SZT-001', ...meta })
    expect(state.traces[0].status).toBe('预检通过')
    expect(() => transition(state, { type: 'trace', plotId: 'SZT-001', ...meta })).toThrow('已生成')
    state = transition(state, { type: 'traceRun', id: state.traces[0].id, fail: true, ...meta })
    state = transition(state, { type: 'traceRun', id: state.traces[0].id, fail: false, ...meta })
    expect(state.traces).toHaveLength(1)
    expect(state.traces[0].attempts).toBe(2)
    expect(state.traces[0].detail).toContain('无一品一码正式回执')
  })
  it('重复机构报告、非法pH和缺失地块不能入档', () => {
    const seed = createFarmSeed()
    expect(() => transition(seed, { type: 'soil', report: seed.soils[0], ...meta })).toThrow('已存在')
    expect(() => transition(seed, { type: 'soil', report: { ...seed.soils[0], reportNo: 'NEW', ph: 15 }, ...meta })).toThrow('pH范围')
    expect(traceIssues(seed, 'NONE')).toEqual(['地块不存在'])
  })
  it('未知演示动作不能静默写入缓存日志', () => {
    expect(() => reduce(createFarmSeed(), { type: 'unknown' } as unknown as Omit<Action, 'at' | 'eventId'>)).toThrow('不支持')
  })
})
