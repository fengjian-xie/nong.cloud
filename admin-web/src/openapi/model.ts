import type { ApiEnvelope } from '../types'
import { allowedScopes, endpoints, kinds, webhookEvents } from './catalog'
import type { AppKind, Endpoint } from './catalog'

export type PartnerApp = { id: string; name: string; organization: string; kind: AppKind; scopes: string[]; status: '待审核' | '沙箱启用' | '已停用'; keyVersion: number; quota: number; callback: string; events: string[] }
export type Call = { id: string; appId: string; endpoint: string; method: string; status: number; at: number; replay: boolean }
export type ApiState = { apps: PartnerApp[]; calls: Call[]; counters: { total: number; success: number; failures: number }; audit: string[]; windows: Record<string, { minute: number; used: number }>; dedup: Record<string, { fingerprint: string; envelope: ApiEnvelope<unknown> }> }
export type AppCommand = { type: 'create'; app: Omit<PartnerApp, 'status' | 'keyVersion'> } | { type: 'approve'; id: string; consent: boolean } | { type: 'rotate'; id: string; confirmation: string } | { type: 'disable'; id: string; confirmation: string }
export type DebugInput = { appId: string; endpointId: string; keyVersion: number; parameters: string; objectId: string; idempotencyKey: string; at: number; traceId: string }
export type DebugResult = { state: ApiState; envelope: ApiEnvelope<unknown>; status: number; replay: boolean }
const guard: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message) }
export const STORAGE_KEY = 'xiangqiao-open-api-demo-apps-v1'
export function createApiSeed(apps?: PartnerApp[]): ApiState {
  return { apps: apps || [
    { id: 'DEMO-APP-001', name: '产业带采购看板', organization: '合作采购方（演示）', kind: '采购合作', scopes: ['maturity.read', 'resources.read'], status: '沙箱启用', keyVersion: 1, quota: 60, callback: '', events: [] },
    { id: 'DEMO-APP-002', name: '检测报告协同', organization: '合作检测机构（演示）', kind: '检测机构', scopes: ['soil.report.write'], status: '待审核', keyVersion: 0, quota: 30, callback: '', events: [] },
  ], calls: [], counters: { total: 0, success: 0, failures: 0 }, audit: [], windows: {}, dedup: {} }
}
function validateApp(app: Omit<PartnerApp, 'status' | 'keyVersion'>) {
  guard(/^DEMO-[A-Za-z0-9-]{1,70}$/.test(app.id) && typeof app.name === 'string' && app.name.trim().length > 0 && app.name.length <= 50 && typeof app.organization === 'string' && app.organization.trim().length > 0 && app.organization.length <= 80, '请输入有效的演示编号、应用名称和经营主体')
  guard(kinds.includes(app.kind) && Array.isArray(app.scopes) && app.scopes.length > 0 && new Set(app.scopes).size === app.scopes.length && app.scopes.every(s => allowedScopes[app.kind].includes(s)), '接口权限与应用用途不匹配，请至少选择一个允许的接口')
  guard(Number.isInteger(app.quota) && app.quota >= 1 && app.quota <= 120, '本地沙箱配额须为1–120次/分钟')
  guard(typeof app.callback === 'string' && app.callback.length <= 500 && Array.isArray(app.events) && app.events.every(e => webhookEvents[app.kind].includes(e)), '事件订阅参数无效')
  if (app.callback) {
    const url = new URL(app.callback)
    guard(url.protocol === 'https:' && !url.username && !url.password && !url.hash, '回调地址需HTTPS且不能含凭据或片段；此处不会访问该地址')
  }
  guard(!app.events.length || !!app.callback, '事件订阅需要填写HTTPS回调地址')
}
export function restoreApps(raw: string | null): PartnerApp[] | undefined {
  if (!raw) return undefined
  const parsed: unknown = JSON.parse(raw)
  guard(Array.isArray(parsed) && parsed.length > 0 && parsed.length <= 20, '应用缓存无效')
  for (const value of parsed) { guard(value && typeof value === 'object', '应用缓存无效'); const app = value as PartnerApp; validateApp(app); guard(['待审核', '沙箱启用', '已停用'].includes(app.status) && Number.isInteger(app.keyVersion) && app.keyVersion >= 0 && app.keyVersion <= 100000 && (app.status !== '沙箱启用' || app.keyVersion > 0), '应用状态缓存无效') }
  guard(new Set(parsed.map(a => a.id)).size === parsed.length, '应用编号重复')
  return parsed.map(({ id, name, organization, kind, scopes, status, keyVersion, quota, callback, events }: PartnerApp) => ({ id, name, organization, kind, scopes, status, keyVersion, quota, callback, events }))
}
export function updateApps(state: ApiState, command: AppCommand): ApiState {
  let apps = state.apps; let message = ''
  const app = 'id' in command ? apps.find(a => a.id === command.id) : undefined
  if (command.type === 'create') {
    validateApp(command.app); guard(apps.length < 20 && !apps.some(a => a.id === command.app.id), '应用数量已达上限或编号重复')
    apps = [{ ...command.app, name: command.app.name.trim(), organization: command.app.organization.trim(), status: '待审核', keyVersion: 0 }, ...apps]; message = `创建 ${command.app.name}，仅演示待审核`
  } else if (command.type === 'approve') {
    guard(app?.status === '待审核' && command.consent === true, '需确认应用用途与授权范围，且只能处理待审核应用')
    apps = apps.map(a => a.id === app.id ? { ...a, status: '沙箱启用', keyVersion: a.keyVersion + 1 } : a); message = `${app.name} 模拟审核开通，不是生产凭据`
  } else {
    guard(app?.status === '沙箱启用' && command.confirmation === app.name, '请输入应用全名确认；只能处理已启用沙箱应用')
    apps = apps.map(a => a.id === app.id ? { ...a, ...(command.type === 'disable' ? { status: '已停用' as const } : {}), keyVersion: a.keyVersion + 1 } : a)
    message = `${app.name} ${command.type === 'disable' ? '已停用沙箱' : '轮换演示版本，旧版本不再通过本地校验'}`
  }
  return { ...state, apps, audit: [message, ...state.audit].slice(0, 30) }
}
const stableJson = (value: unknown): string => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`
  return JSON.stringify(value)
}
function payloadError(endpoint: Endpoint, payload: Record<string, unknown>, objectId: string) {
  if (endpoint.pathParameter && !/^DEMO-[A-Za-z0-9-]{1,70}$/.test(objectId)) return '本地沙箱只接受DEMO对象编号；正式对象归属必须在服务端校验'
  if (Object.keys(payload).some(k => !endpoint.fields.some(f => f.name === k))) return '参数含未知字段；租户、主体与授权关系不能由客户端任意指定'
  for (const field of endpoint.fields) {
    const value = payload[field.name]
    if (value === undefined) { if (field.required) return `${field.name} 为必填参数`; continue }
    if (field.type === 'string' ? typeof value !== 'string' || !value.trim() || value.length > 500 : typeof value !== 'number' || !Number.isFinite(value) || (field.type === 'integer' && !Number.isInteger(value))) return `${field.name} 类型或内容无效`
    if (field.minimum !== undefined && (value as number) < field.minimum || field.maximum !== undefined && (value as number) > field.maximum) return `${field.name} 超出允许范围`
    if (field.enum && !field.enum.includes(value as string)) return `${field.name} 不在允许选项内`
  }
  if (endpoint.id === 'events' && payload.plot_id !== 'DEMO-PLOT-001') return 'OBJECT_FORBIDDEN'
  if (endpoint.id === 'card-sync' && (!/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(String(payload.occurred_at)) || !Number.isFinite(Date.parse(String(payload.occurred_at))))) return 'occurred_at 需有效的带时区采集时间'
  // Demo object allowlist only; it is not proof of consent, a device signature or real media ownership.
  if (endpoint.id === 'card-sync' && objectId !== 'DEMO-CARD-001' || endpoint.id === 'receipt' && objectId !== 'DEMO-ORDER-001' || endpoint.id === 'soil' && payload.sample_id !== 'DEMO-SAMPLE-001' || endpoint.id === 'trace' && payload.plot_id !== 'DEMO-PLOT-001') return 'OBJECT_FORBIDDEN'
  return ''
}
function mockData(endpoint: Endpoint, p: Record<string, unknown>, traceId: string) {
  if (endpoint.method === 'POST') return { id: `DEMO-${traceId}`, status: endpoint.id === 'receipt' ? '待委托方验收' : endpoint.id === 'soil' ? '待运营核验' : endpoint.id === 'trace' ? '仅生成本地预检示例，无外部回执' : '仅模拟接收，未写入实物卡或正式农事记录' }
  const source: Record<string, Record<string, unknown>[]> = {
    maturity: [{ listing_id: 'DEMO-LIST-001', crop: '阳光玫瑰葡萄', town: '赛岐镇（示例）', area_mu: 12, estimated_harvest: '2026-09-05', intended_supply_kg: 14000, forecast_only: true }, { listing_id: 'DEMO-LIST-002', crop: '夏黑葡萄', town: '赛岐镇（示例）', area_mu: 6, estimated_harvest: '2026-09-08', intended_supply_kg: 6000, forecast_only: true }],
    resources: [{ resource_id: 'DEMO-RES-001', type: '农服队', town: '赛岐镇（示例）', status: '人工维护：可预约' }, { resource_id: 'DEMO-RES-002', type: '冷库', town: '赛岐镇（示例）', status: '未接入遥测，不判断实时运营' }],
    inventory: [{ listing_id: 'DEMO-STOCK-001', product: '阳光玫瑰葡萄', grade: 'B级', available_kg: 1000, shared_by_owner: true }],
    events: [{ event_id: 'DEMO-EVENT-001', plot_id: 'DEMO-PLOT-001', operation: '修剪', occurred_at: '2026-08-29T09:20:00+08:00', config_version: 1, verification: '待核验' }],
  }
  const rows = (source[endpoint.id] || []).filter(item => !p.crop || String(item.crop).includes(String(p.crop)))
  const page = Number(p.page || 1); const size = Number(p.size || 20)
  return { items: rows.slice((page - 1) * size, page * size), total: rows.length, page, size, hasNext: page * size < rows.length }
}
export function simulateApi(state: ApiState, input: DebugInput): DebugResult {
  guard(state.counters.total < 1000, '当前会话调试次数已达1000次上限，请重新加载页面；调用日志不持久保存')
  const endpoint = endpoints.find(e => e.id === input.endpointId)
  guard(endpoint, '请选择有效接口')
  const app = state.apps.find(a => a.id === input.appId)
  let status = 200; let message = 'OK（本地模拟）'; let data: unknown = null; let replay = false
  let windows = state.windows; let dedup = state.dedup
  const reject = (code: number, text: string) => { status = code; message = text }
  if (!app || app.status !== '沙箱启用' || input.keyVersion !== app.keyVersion) reject(401, '应用未启用、已停用或演示密钥版本已失效')
  else {
    const minute = Math.floor(input.at / 60000)
    const prior = state.windows[app.id]
    const used = prior?.minute === minute ? prior.used : 0
    windows = { ...windows, [app.id]: { minute, used: used + 1 } }
    if (used >= app.quota) reject(429, '超出本应用本分钟的本地演示配额')
    else if (!app.scopes.includes(endpoint.scope)) reject(403, `缺少接口权限：${endpoint.scope}`)
    else {
      let payload: Record<string, unknown> = {}
      try { const value: unknown = JSON.parse(input.parameters); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object'); payload = value as Record<string, unknown> } catch { reject(400, '参数需为有效JSON对象') }
      if (status === 200) { const error = payloadError(endpoint, payload, input.objectId); if (error) reject(error === 'OBJECT_FORBIDDEN' ? 403 : 400, error === 'OBJECT_FORBIDDEN' ? '该演示对象不在应用沙箱允许范围；正式环境须对象级授权' : error) }
      if (status === 200 && endpoint.method === 'POST' && !/^[A-Za-z0-9_-]{8,100}$/.test(input.idempotencyKey)) reject(400, '写接口需要8–100字符的Idempotency-Key（字母、数字、下划线或连字符）')
      if (status === 200) {
        const fingerprint = `${endpoint.id}|${input.objectId}|${stableJson(payload)}`
        const cacheKey = `${app!.id}|${input.idempotencyKey}`
        const previous = endpoint.method === 'POST' ? dedup[cacheKey] : undefined
        if (previous && previous.fingerprint !== fingerprint) reject(409, '同一幂等键不能提交不同接口、对象或参数')
        else if (previous) { data = previous.envelope.data; replay = true; message = '命中本地幂等结果，未再次提交' }
        else { data = mockData(endpoint, payload, input.traceId); if (endpoint.method === 'POST') dedup = { ...dedup, [cacheKey]: { fingerprint, envelope: { code: 0, message, data, traceId: input.traceId, timestamp: new Date(input.at).toISOString() } } } }
      }
    }
  }
  const envelope: ApiEnvelope<unknown> = { code: status === 200 ? 0 : status, ...(status === 200 ? {} : { errorCode: `XQ-OPEN-${status}-001` }), message, data, traceId: input.traceId, timestamp: new Date(input.at).toISOString() }
  const call: Call = { id: input.traceId, appId: input.appId, endpoint: endpoint.path, method: endpoint.method, status, at: input.at, replay }
  return { state: { ...state, windows, dedup, calls: [call, ...state.calls].slice(0, 50), counters: { total: state.counters.total + 1, success: state.counters.success + (status === 200 ? 1 : 0), failures: state.counters.failures + (status === 200 ? 0 : 1) } }, status, envelope, replay }
}
