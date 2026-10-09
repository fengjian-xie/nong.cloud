import { describe, expect, it } from 'vitest'
import { endpoints, openApiDraft, requestCurl, sandboxBase } from './catalog'
import { createApiSeed, restoreApps, simulateApi, updateApps } from './model'
import type { ApiState, DebugInput } from './model'

const input = (overrides: Partial<DebugInput> = {}): DebugInput => ({ appId: 'DEMO-APP-001', endpointId: 'maturity', keyVersion: 1, parameters: '{"page":1,"size":20}', objectId: 'DEMO-CARD-001', idempotencyKey: 'DEMO-REQUEST-001', at: Date.UTC(2026, 9, 4, 0), traceId: 'DEMO-TRACE-001', ...overrides })
const cardState = (): ApiState => { const seed = createApiSeed(); return { ...seed, apps: [{ ...seed.apps[0], kind: '设备接入', scopes: ['cards.events.write', 'events.read'] }] } }
const cardInput = (overrides: Partial<DebugInput> = {}) => input({ endpointId: 'card-sync', parameters: JSON.stringify(endpoints.find(e => e.id === 'card-sync')!.example), ...overrides })

describe('开放API本地模型', () => {
  it('初始无伪造网关统计，公开结果不含私有数据', () => {
    const seed = createApiSeed(); expect(seed.counters.total).toBe(0); expect(seed.calls).toHaveLength(0)
    const result = simulateApi(seed, input())
    expect(result.status).toBe(200); expect(result.envelope.code).toBe(0)
    expect(result.envelope.data).toMatchObject({ total: 2, page: 1, size: 20, hasNext: false })
    expect(JSON.stringify(result.envelope)).not.toMatch(/gps|cost|陈建国|XQ-C0001|家庭/)
    expect(result.state.counters).toEqual({ total: 1, success: 1, failures: 0 })
  })
  it('分页、产品筛选与空结果可用', () => {
    expect(simulateApi(createApiSeed(), input({ parameters: '{"page":2,"size":1}' })).envelope.data).toMatchObject({ total: 2, page: 2, size: 1, hasNext: false })
    expect(simulateApi(createApiSeed(), input({ parameters: '{"crop":"不存在"}' })).envelope.data).toMatchObject({ items: [], total: 0 })
  })
  it.each(['invalid', '[]', '{"page":0}', '{"page":1.5}', '{"size":101}', '{"tenantId":"other"}'])('无效参数%s返回400', parameters => {
    const result = simulateApi(createApiSeed(), input({ parameters })); expect(result.status).toBe(400); expect(result.envelope.data).toBeNull()
  })
  it('未审核、停用与失效演示版本被拒绝', () => {
    const state = createApiSeed()
    expect(simulateApi(state, input({ appId: 'DEMO-APP-002', keyVersion: 0 })).status).toBe(401)
    expect(simulateApi(state, input({ keyVersion: 99 })).status).toBe(401)
    const disabled = updateApps(state, { type: 'disable', id: state.apps[0].id, confirmation: state.apps[0].name })
    expect(simulateApi(disabled, input({ keyVersion: 2 })).status).toBe(401)
  })
  it('接口权限与对象授权分别拒绝越权', () => {
    expect(simulateApi(createApiSeed(), input({ endpointId: 'inventory' })).status).toBe(403)
    expect(simulateApi(cardState(), input({ endpointId: 'events', parameters: '{"plot_id":"DEMO-PLOT-002"}' })).status).toBe(403)
    expect(simulateApi(cardState(), cardInput({ objectId: 'DEMO-CARD-002' })).status).toBe(403)
    expect(simulateApi(cardState(), cardInput({ objectId: 'REAL-CARD-001' })).status).toBe(400)
  })
  it('相同幂等键重放，正文顺序改变不重复，内容不同返回409', () => {
    const first = simulateApi(cardState(), cardInput())
    const body = JSON.parse(cardInput().parameters)
    const reordered = JSON.stringify({ occurred_at: body.occurred_at, config_version: body.config_version, operation: body.operation, clientSeq: body.clientSeq })
    const replay = simulateApi(first.state, cardInput({ parameters: reordered, traceId: 'DEMO-TRACE-002' }))
    expect(replay.status).toBe(200); expect(replay.replay).toBe(true); expect(replay.envelope.data).toEqual(first.envelope.data)
    expect(replay.envelope.traceId).toBe('DEMO-TRACE-002')
    const conflict = simulateApi(replay.state, cardInput({ parameters: JSON.stringify({ ...body, clientSeq: 2 }) }))
    expect(conflict.status).toBe(409); expect(Object.keys(conflict.state.dedup)).toHaveLength(1)
  })
  it('卡片要求幂等键、有效时区时间和合法按键配置', () => {
    expect(simulateApi(cardState(), cardInput({ idempotencyKey: '' })).status).toBe(400)
    const example = endpoints.find(e => e.id === 'card-sync')!.example
    for (const change of [{ occurred_at: '2026-08-29 09:20' }, { clientSeq: 0 }, { config_version: 0 }, { operation: '任意作业' }]) expect(simulateApi(cardState(), cardInput({ parameters: JSON.stringify({ ...example, ...change }) })).status).toBe(400)
  })
  it('限流窗口跨分钟恢复，错误请求也计入配额', () => {
    const seed = createApiSeed(); seed.apps[0].quota = 1
    const first = simulateApi(seed, input({ endpointId: 'inventory' }))
    expect(first.status).toBe(403)
    const limited = simulateApi(first.state, input()); expect(limited.status).toBe(429)
    expect(simulateApi(limited.state, input({ at: input().at + 60000 })).status).toBe(200)
  })
  it('调用日志只保留50条无参数与凭据的元数据，总数单独累计', () => {
    let state = createApiSeed()
    for (let n = 0; n < 55; n++) state = simulateApi(state, input({ traceId: `DEMO-TRACE-${n}` })).state
    expect(state.calls).toHaveLength(50); expect(state.counters.total).toBe(55)
    expect(Object.keys(state.calls[0]).sort()).toEqual(['appId', 'at', 'endpoint', 'id', 'method', 'replay', 'status'])
    expect(() => simulateApi({ ...state, counters: { ...state.counters, total: 1000 } }, input())).toThrow('上限')
  })
  it('申请用途限制权限，订阅需要HTTPS；审批与敏感操作须确认', () => {
    const state = createApiSeed(); const app = { ...state.apps[0], id: 'DEMO-NEW-001', scopes: ['inventory.read'] }
    expect(() => updateApps(state, { type: 'create', app: { ...app, scopes: ['events.read'] } })).toThrow('不匹配')
    expect(() => updateApps(state, { type: 'create', app: { ...app, events: ['public.inventory.updated'] } })).toThrow('HTTPS')
    expect(() => updateApps(state, { type: 'create', app: { ...app, callback: 'http://example.com' } })).toThrow('HTTPS')
    const created = updateApps(state, { type: 'create', app }); expect(created.apps[0].status).toBe('待审核')
    expect(() => updateApps(created, { type: 'approve', id: app.id, consent: false })).toThrow('确认')
    const approved = updateApps(created, { type: 'approve', id: app.id, consent: true }); expect(approved.apps[0].keyVersion).toBe(1)
    expect(() => updateApps(approved, { type: 'rotate', id: app.id, confirmation: '' })).toThrow('全名')
    const rotated = updateApps(approved, { type: 'rotate', id: app.id, confirmation: app.name }); expect(rotated.apps[0].keyVersion).toBe(2)
    expect(simulateApi(rotated, input({ appId: app.id, endpointId: 'inventory', keyVersion: 1 })).status).toBe(401)
  })
  it('缓存校验拒绝损坏、重复与不匹配权限，剔除额外字段', () => {
    expect(restoreApps(null)).toBeUndefined()
    expect(() => restoreApps('{broken')).toThrow()
    expect(() => restoreApps('[]')).toThrow('缓存')
    const apps = createApiSeed().apps
    expect(() => restoreApps(JSON.stringify([apps[0], apps[0]]))).toThrow('重复')
    expect(() => restoreApps(JSON.stringify([{ ...apps[0], scopes: ['events.read'] }]))).toThrow('不匹配')
    const restored = restoreApps(JSON.stringify([{ ...apps[0], secret: 'DO_NOT_PERSIST', calls: [] }]))!
    expect(restored).toEqual([apps[0]]); expect(JSON.stringify(restored)).not.toContain('secret')
  })
  it('所有写接口只模拟提交，不自验收或伪造官方回执', () => {
    for (const endpoint of endpoints.filter(e => e.method === 'POST')) {
      const seed = createApiSeed(); const kind = endpoint.id === 'card-sync' ? '设备接入' : endpoint.id === 'receipt' ? '服务协同' : endpoint.id === 'soil' ? '检测机构' : '追溯适配'
      seed.apps = [{ ...seed.apps[0], kind, scopes: [endpoint.scope] }]
      const result = simulateApi(seed, input({ endpointId: endpoint.id, objectId: endpoint.id === 'receipt' ? 'DEMO-ORDER-001' : 'DEMO-CARD-001', parameters: JSON.stringify(endpoint.example) }))
      expect(result.status).toBe(200); expect(result.envelope.data).toHaveProperty('status')
      expect(JSON.stringify(result.envelope.data)).not.toMatch(/已验收|已认证|报送成功/)
    }
  })
  it('导出草案路径与参数位置完整；cURL换行与单引号安全', () => {
    const draft = openApiDraft(); expect(draft.openapi).toBe('3.0.3'); expect(Object.keys(draft.paths)).toHaveLength(8)
    expect(draft.servers[0].url).toBe(sandboxBase)
    const card = endpoints.find(e => e.id === 'card-sync')!
    const operation = draft.paths[card.path].post
    expect(operation.parameters).toContainEqual({ name: 'card_id', in: 'path', required: true, schema: { type: 'string' } })
    expect(operation.parameters.some(p => p.name === 'Idempotency-Key' && p.required)).toBe(true)
    expect(operation.requestBody?.content['application/json'].schema.required).toContain('clientSeq')
    const curl = requestCurl(card, { operation: "farmer's field" })
    expect(curl.split('\n')).toHaveLength(7); expect(curl.split('\n')[1].endsWith(String.fromCharCode(92))).toBe(true)
    expect(curl).toContain("farmer'\"'\"'s field"); expect(curl).toContain('DEMO_TOKEN_NOT_VALID'); expect(curl).not.toContain('\\n')
  })
})
