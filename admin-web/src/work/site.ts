import { getRole } from '../portals/config'
import type { RoleId } from '../portals/config'

export const workTitle = '乡桥农事主体工作台 · work.nong.cloud'
export const workDescription = '种植户、合作社、采购商、农资与农服等主体的统一演示工作台；真实账号与权限待接入。'
export const isWorkSiteHost = (host: string) => host.toLowerCase() === 'work.nong.cloud'
export const WORK_SESSION_KEY = 'xiangqiao:work-demo-session:v2'

export const demoAccounts = [
  { id: 'farm-service', name: '种植与农服示例账号', roles: ['farmer', 'team'] },
  { id: 'purchase-chain', name: '采购与流通示例账号', roles: ['buyer', 'warehouse', 'processor'] },
  { id: 'co-op', name: '合作社示例账号', roles: ['cooperative'] },
  { id: 'agri-supply', name: '农资门店示例账号', roles: ['supplier'] },
  { id: 'machine-service', name: '农机服务示例账号', roles: ['machine'] },
  { id: 'protection-service', name: '植保服务示例账号', roles: ['protection'] },
  { id: 'soil-lab', name: '检测机构示例账号', roles: ['lab'] },
  { id: 'family-agent', name: '子女代办示例账号', roles: ['family'] },
] as const satisfies readonly { id: string; name: string; roles: readonly RoleId[] }[]
export type DemoAccount = typeof demoAccounts[number]
export type DemoSession = { version: 2; accountId: DemoAccount['id']; activeRole: RoleId }
export const getDemoAccount = (id?: string) => demoAccounts.find(account => account.id === id)
export const hasIdentity = (account: DemoAccount, role: string): role is RoleId => (account.roles as readonly string[]).includes(role)

// A selected demo role is not an authentication credential or server authority.
export function loadDemoSession(): { session?: DemoSession; warning: string } {
  try {
    const raw = sessionStorage.getItem(WORK_SESSION_KEY)
    if (!raw) return { warning: '' }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { warning: '' }
    const value = parsed as { version?: unknown; accountId?: unknown; activeRole?: unknown }
    const account = typeof value.accountId === 'string' ? getDemoAccount(value.accountId) : undefined
    const role = typeof value.activeRole === 'string' ? getRole(value.activeRole) : undefined
    return value.version === 2 && account && role && hasIdentity(account, role.id)
      ? { session: { version: 2, accountId: account.id, activeRole: role.id }, warning: '' } : { warning: '' }
  } catch { return { warning: '浏览器会话储存不可用；演示身份仅在当前页面有效。' } }
}

export function saveDemoSession(session?: DemoSession): string {
  try {
    if (session) sessionStorage.setItem(WORK_SESSION_KEY, JSON.stringify({ version: 2, accountId: session.accountId, activeRole: session.activeRole }))
    else sessionStorage.removeItem(WORK_SESSION_KEY)
    return ''
  } catch { return '浏览器会话储存不可用；演示身份仅在当前页面有效。' }
}

// Clear only this prototype account's cache, never unrelated localStorage.
export function clearWorkDemoData(accountId?: DemoAccount['id']): string {
  if (!accountId) return ''
  try {
    for (const scope of ['farm', 'portal', 'value']) localStorage.removeItem(`xiangqiao:work-demo:${scope}:${accountId}`)
    const helpPrefix = `xiangqiao:work-demo:help:${encodeURIComponent(accountId)}:`
    const helpKeys = Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter((key):key is string=>!!key&&key.startsWith(helpPrefix))
    for (const key of helpKeys) localStorage.removeItem(key)
    return ''
  } catch { return '已退出；浏览器阻止清理本账号演示缓存，请在共享设备上清理本站数据。' }
}
