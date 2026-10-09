import { describe, expect, it } from 'vitest'
import { categories, createTicket, methods, parseTickets, seedQueue, storageKey, transition } from './model'
const owner = { accountId: 'farm-service', identityId: 'farmer', label: '种植户（演示）' }
const create = () => createTicket(owner, categories[0], methods[0], '测试卡片同步记录需要协助核对', 0)
describe('帮助中心状态与范围', () => {
  it('新问题待受理，非法分类、短说明与真实联系资料拒绝', () => {
    expect(create().status).toBe('待受理')
    for (const [category, text] of [['unknown', '测试卡片需要协助核对'], [categories[0], '短'], [categories[0], '我的电话13812345678']]) expect(() => createTicket(owner, category, methods[0], text, 0)).toThrow()
  })
  it('先分派才回复，待用户确认才能关闭，未解决可重开', () => {
    const ticket = create()
    expect(() => transition(ticket, {type:'reply',text:'测试处理说明已经核对记录'})).toThrow()
    const assigned = transition(ticket, {type:'assign',team:'中心客服'})
    const replied = transition(assigned, {type:'reply',text:'演示处理说明：请核对采集时配置版本'} )
    expect(replied.status).toBe('待用户确认')
    expect(() => transition(replied, {type:'confirm',owner:{...owner,identityId:'team'}})).toThrow()
    const closed = transition(replied, {type:'confirm',owner})
    expect(closed.status).toBe('已关闭')
    expect(transition(closed, {type:'reopen',owner}).status).toBe('待受理')
    expect(() => transition(closed, {type:'assign',team:'中心客服'})).toThrow()
  })
  it('回访意向不是呼叫，账号与角色分开缓存', () => {
    expect(seedQueue().find(t => t.method === methods[1])?.timeline).toEqual(['本地登记 · 未提交真实中心'])
    expect(storageKey('user',owner)).not.toBe(storageKey('user',{...owner,identityId:'team'}))
    expect(storageKey('user',owner)).not.toBe(storageKey('user',{...owner,accountId:'other'}))
    expect(storageKey('user',owner)).not.toBe(storageKey('admin',owner))
  })
  it('损坏、超额或非法缓存安全恢复', () => {
    expect(parseTickets('{broken')).toBeNull()
    expect(parseTickets(JSON.stringify({version:1,tickets:[null,{...create(),status:'退款完成'}]}))).toEqual([])
    expect(parseTickets(JSON.stringify({version:2,tickets:[]}))).toBeNull()
    expect(parseTickets(JSON.stringify({version:1,tickets:[create()]}))).toHaveLength(1)
  })
})
