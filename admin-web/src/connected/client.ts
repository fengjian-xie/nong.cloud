export type Identity = { id: string; role: string; label: string; org: string; centerName: string; centerId: string; subjectId: string }
export type Me = { user: { id: string; name: string; username: string }; identities: Identity[]; activeIdentityId: string; permissions: string[] }
export type Row = Record<string, unknown>
export type Page<T = Row> = { items: T[]; total: number; page: number; size: number; hasNext: boolean }
export const connectedMode = import.meta.env.VITE_DATA_MODE === 'backend'
const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
export class BackendError extends Error {
  constructor(message: string, public status: number, public traceId: string, public errorCode = '') { super(message) }
}
// Server state never falls back to prototype/localStorage state on failure.
export async function request<T>(path: string, options: { method?: string; body?: unknown; key?: string; version?: number; signal?: AbortSignal; identity?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-XQ-Client': 'web-v1' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.key) headers['Idempotency-Key'] = options.key
  if (options.version !== undefined) headers['If-Match'] = String(options.version)
  if (options.identity) headers['X-XQ-Identity'] = options.identity
  const response = await fetch(base + path, { method: options.method || 'GET', credentials: 'include', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: options.signal })
  let envelope: { code: number; data: T; message: string; traceId: string; errorCode?: string }
  try { envelope = await response.json() } catch { throw new BackendError('接口未返回有效 JSON，请检查后端和代理配置', response.status, '') }
  if (!response.ok || !envelope || envelope.code !== 0) throw new BackendError(envelope?.message || '请求失败', response.status, envelope?.traceId || '', envelope?.errorCode || '')
  if (!Object.prototype.hasOwnProperty.call(envelope, 'data')) throw new BackendError('接口数据格式不一致，请检查前后端契约', response.status, envelope.traceId || '')
  return envelope.data
}
export function pageRows(data: Page | Row[]): Row[] {
  if (Array.isArray(data)) return data
  if (!data || !Array.isArray(data.items) || !Number.isInteger(data.total) || data.total < 0 || !Number.isInteger(data.page) || data.page < 1 || !Number.isInteger(data.size) || data.size < 1 || data.size > 100 || typeof data.hasNext !== 'boolean' || data.items.length > data.size) throw new BackendError('列表字段与分页契约不一致，请检查接口', 200, '')
  return data.items
}
export function listPath(path: string, page: number, size = 20) {
  const [route, query = ''] = path.split('?'), params = new URLSearchParams(query)
  params.set('page', String(page)); params.set('size', String(size)); return route + '?' + params.toString()
}
export function writeKey() { return crypto.randomUUID() }
