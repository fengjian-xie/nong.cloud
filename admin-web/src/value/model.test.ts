import { expect, it } from 'vitest'
import { createFarmSeed } from '../farm/model'
import { generateStory, gradeMatches, incomeEstimate, publicSummary, reduceValue, restoreValue, seedIncome, seedValueState, type ValueActor, type ValueCommand } from './model'
const farm = createFarmSeed()
const grower: ValueActor = { accountId: 'test-grower', role: 'farmer', plotIds: ['SZT-001'], publicPlotIds: ['SZT-001'], canReview: false, canStory: true }
const apply = (state: ReturnType<typeof seedValueState>, action: ValueCommand, actor = grower) => reduceValue(state, action, actor, farm, '2026-10-06T09:00:00Z', 'test-event')

it('公开摘要是字段白名单，不带卡号、原始GPS、姓名、家庭授权或经营账', () => {
  const seed = seedValueState(grower.accountId, farm)
  const s = publicSummary(farm, seed.passports[0]), raw = JSON.stringify(s)
  expect(s.events.length).toBeGreaterThan(0)
  expect(raw).not.toMatch(/XQ-C|林春梅|accuracy|latitude|longitude|dayRate|income|delegate/)
  expect(s.productTest).toContain('暂无')
  expect(s.soil).toContain('不是产品安全检测')
})
it('不引用未同步、未核验或地块农户不一致事件', () => {
  const changed = structuredClone(farm); changed.records.forEach(r => { r.synced = false })
  expect(publicSummary(changed, seedValueState('test', changed).passports[0]).events).toEqual([])
  expect(() => generateStory(changed, 'SZT-001')).toThrow('暂无')
})
it('保存与提交履历不能自审，换成同账号管理员仍被拒绝', () => {
  let s = seedValueState(grower.accountId, farm)
  s = apply(s, { type: 'passport.save', plotId: 'SZT-001', consent: true, note: '批次实物对应与交接待核对（测试说明）' })
  s = apply(s, { type: 'passport.submit', plotId: 'SZT-001' })
  expect(s.passports[0].status).toBe('待独立审核')
  expect(() => apply(s, { type: 'passport.approve', plotId: 'SZT-001' }, { ...grower, role: 'admin', canReview: true })).toThrow('同一账号')
})
it('其他编辑的核验示例可独立审核，地块版本变化后拒绝', () => {
  const s = seedValueState('reviewer', farm), reviewer = { ...grower, accountId: 'reviewer', role: 'admin', canReview: true }
  s.passports[0].consent = true; s.passports[0].status = '待独立审核'
  expect(apply(s, { type: 'passport.approve', plotId: 'SZT-001' }, reviewer).passports[0].status).toBe('演示已发布')
  const changed = structuredClone(farm); changed.plots[0].version = 2
  expect(() => reduceValue(s, { type: 'passport.approve', plotId: 'SZT-001' }, reviewer, changed, 'now', 'new')).toThrow('失效')
  expect(publicSummary(changed, s.passports[0]).status).toContain('待复核')
})
it('跨账号、跨地块、采购身份不能写生产履历与经营账', () => {
  const s = seedValueState(grower.accountId, farm)
  expect(() => apply(s, { type: 'passport.withdraw', plotId: 'SZT-002' })).toThrow('范围')
  expect(() => apply(s, { type: 'subscribe', plotId: 'SZT-001' }, { ...grower, accountId: 'other' })).toThrow('账号')
  expect(() => apply(s, { type: 'income', plotId: 'SZT-001', input: { ...seedIncome, quantityKg: '100' } }, { ...grower, role: 'buyer' })).toThrow('经营账')
})
it('没有主动供货授权的摘要不能关注或询价', () => {
  const buyer = { ...grower, role: 'buyer', plotIds: [], publicPlotIds: [] }, s = seedValueState(grower.accountId, farm)
  expect(() => apply(s, { type: 'subscribe', plotId: 'SZT-001' }, buyer)).toThrow('无可关注')
  expect(() => apply(s, { type: 'followup', kind: '询价', target: 'SZT-001', text: '测试采购询价与交接要求' }, buyer)).toThrow('授权供货')
})
it('成熟窗口验证日期、版本、数量区间和来源', () => {
  const s = seedValueState(grower.accountId, farm), draft = { plotId: 'SZT-001', start: '2026-09-01', end: '2026-09-10', minKg: 1000, maxKg: 14000, source: '种植方人工复核预测（测试）', version: 1 }
  expect(apply(s, { type: 'window', draft }).windows).toHaveLength(1)
  expect(() => apply(s, { type: 'window', draft: { ...draft, start: '2026-02-30' } })).toThrow('日期')
  expect(() => apply(s, { type: 'window', draft: { ...draft, maxKg: 100 } })).toThrow('区间')
})
it('经营净收益包括农服、包装、冷链、配送、售后、卡片和家庭劳动', () => {
  const input = { ...seedIncome, revenue: '10000', materials: '1000', services: '500', packaging: '200', coldChain: '300', delivery: '100', afterSale: '20', laborDays: '10', dayRate: '100', quantityKg: '1000' }
  const result = incomeEstimate(input)
  expect(result.cash).toBe(2220); expect(result.fullNet).toBe(6780)
  expect(() => incomeEstimate({ ...input, services: '' })).toThrow('空白')
  expect(() => incomeEstimate({ ...input, quantityKg: '0' })).toThrow('正数')
  expect(incomeEstimate({ ...input, revenue: '0' }).fullNet).toBe(-3220)
})
it('记录要有核验来源、媒体确认和额外代办授权，不发布', () => {
  const generated = generateStory(farm, 'SZT-001'), s = seedValueState(grower.accountId, farm)
  const action: ValueCommand = { type: 'story', plotId: 'SZT-001', ...generated, mediaConfirmed: true }
  expect(apply(s, action).stories[0].status).toBe('待本人确认草稿')
  expect(() => apply(s, { ...action, mediaConfirmed: false })).toThrow('媒体授权')
  expect(() => apply(s, action, { ...grower, role: 'family', canStory: false })).toThrow('未获')
  expect(() => apply(s, { ...action, evidenceIds: ['not-verified'] })).toThrow('证据')
})
it('分级换算2000斤为1000kg，只匹配共享、时效内且足量的批次', () => {
  const result = gradeMatches(farm, '葡萄', 'B级', '2000', '斤')
  expect(result.kg).toBe(1000); expect(result.rows.map(r => r.batchId)).toEqual(['BATCH-001'])
  expect(gradeMatches(farm, '葡萄', 'B级', '2000', 'kg').rows).toEqual([])
  expect(() => gradeMatches(farm, '葡萄', 'B级', '-1', '斤')).toThrow()
  expect(gradeMatches(farm, '葡萄', 'B级', '2000', '斤', { 'BATCH-001': 800 }).rows).toEqual([])
})
it('审核示例仅审核岗位可载入，不覆盖自身编辑稿', () => {
  const s = seedValueState(grower.accountId, farm), admin = { ...grower, role: 'admin', canReview: true }
  expect(() => apply(s, { type: 'review.example', plotId: 'SZT-001' })).toThrow('审核岗位')
  const sample = apply(s, { type: 'review.example', plotId: 'SZT-001' }, admin)
  expect(apply(sample, { type: 'passport.approve', plotId: 'SZT-001' }, admin).passports[0].status).toBe('演示已发布')
  const edited = apply(s, { type: 'passport.save', plotId: 'SZT-001', consent: true, note: '本人编辑的批次草稿不允许覆盖为他人稿' })
  expect(() => apply(edited, { type: 'review.example', plotId: 'SZT-001' }, admin)).toThrow('覆盖')
})
it('旧缓存、损坏字段和其他账号缓存不继承，重复草稿ID拒绝', () => {
  const s = seedValueState(grower.accountId, farm)
  expect(restoreValue('{bad', grower.accountId, farm).followups).toEqual([])
  expect(restoreValue(JSON.stringify({ ...s, owner: 'other', subscriptions: ['SZT-001'] }), grower.accountId, farm).subscriptions).toEqual([])
  const command: ValueCommand = { type: 'followup', kind: '反馈', target: 'batch-demo', text: '测试交付数量与损耗反馈' }
  const next = apply(s, command)
  expect(() => apply(next, command)).toThrow('重复')
})
