export const socialPlatforms = [{ id: 'video', name: '视频号' }, { id: 'douyin', name: '抖音' }, { id: 'xiaohongshu', name: '小红书' }] as const
export type SocialId = typeof socialPlatforms[number]['id']
export type SocialAccount = { id: SocialId; centerId: string; accountName: string; href: string; enabled: boolean }
export const socialPreviewKey = (centerId: string) => `xiangqiao:social-preview:v1:${encodeURIComponent(centerId)}`
const allowedHosts: Record<SocialId, string[]> = {
  video: ['channels.weixin.qq.com', 'weixin.qq.com', 'mp.weixin.qq.com'],
  douyin: ['douyin.com', 'www.douyin.com', 'v.douyin.com'],
  xiaohongshu: ['xiaohongshu.com', 'www.xiaohongshu.com', 'xhslink.com', 'www.xhslink.com'],
}
export function emptySocialAccounts(centerId: string): SocialAccount[] { return socialPlatforms.map(p => ({ id: p.id, centerId, accountName: '', href: '', enabled: false })) }
export function validateSocialAccount(a: SocialAccount) {
  if (!socialPlatforms.some(p => p.id === a.id) || typeof a.centerId !== 'string' || typeof a.accountName !== 'string' || a.accountName.length > 50 || typeof a.href !== 'string' || typeof a.enabled !== 'boolean') throw new Error('社交账号格式无效')
  if (/1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(a.accountName)) throw new Error('演示账号名不填写真实联系方式')
  if (a.enabled && (!a.href || !a.accountName.trim())) throw new Error('启用图标链接前请填写账号名称和官方主页链接')
  if (!a.href) return
  let url: URL
  try { url = new URL(a.href) } catch { throw new Error('请填写官方平台HTTPS主页链接') }
  if (a.href.length > 300 || url.protocol !== 'https:' || !allowedHosts[a.id].includes(url.hostname) || url.username || url.password || url.port || url.search || url.hash) throw new Error('请使用对应官方平台HTTPS链接，不含凭据、查询参数或片段；不要填直播、视频流或密钥地址')
}
export function readSocialPreview(raw: string | null, centerId: string): SocialAccount[] {
  if (!raw) return emptySocialAccounts(centerId)
  try {
    const v = JSON.parse(raw)
    if (v.version !== 1 || v.centerId !== centerId || !Array.isArray(v.accounts) || v.accounts.length !== 3 || new Set(v.accounts.map((a: SocialAccount) => a.id)).size !== 3) return emptySocialAccounts(centerId)
    for (const a of v.accounts) { if (a.centerId !== centerId) return emptySocialAccounts(centerId); validateSocialAccount(a) }
    return v.accounts
  } catch { return emptySocialAccounts(centerId) }
}
