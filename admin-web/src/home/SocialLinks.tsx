import { useEffect, useState } from 'react'
import { emptySocialAccounts, readSocialPreview, socialPlatforms, socialPreviewKey, type SocialId } from '../content/social'
import { connectedMode } from '../connected/client'
import { ServerSocial } from '../connected/PublicContent'

// Code-native icons; account links remain empty until the owner supplies them.
export function SocialIcon({ id }: { id: SocialId }) {
  if (id === 'video') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="#f2b437"/><path d="M9 9c4-3 10-1 11 4M8 17c-2-4 0-8 4-9M18 23c-4 2-9 0-10-4M24 14c2 4 0 8-4 10" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/><path d="m14 12 7 4-7 4z" fill="#fff"/></svg>
  if (id === 'douyin') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="#111"/><path d="M19 7v13a5 5 0 1 1-4-5v3a2 2 0 1 0 1 2V7zm0 0c0 4 3 6 6 6v3c-3 0-5-1-6-2" fill="#25f4ee" transform="translate(-1 0)"/><path d="M19 7v13a5 5 0 1 1-4-5v3a2 2 0 1 0 1 2V7zm0 0c0 4 3 6 6 6v3c-3 0-5-1-6-2" fill="#fe2c55" transform="translate(1 1)"/><path d="M19 7v13a5 5 0 1 1-4-5v3a2 2 0 1 0 1 2V7zm0 0c0 4 3 6 6 6v3c-3 0-5-1-6-2" fill="#fff"/></svg>
  return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="#ff2442"/><text x="16" y="20" fill="#fff" textAnchor="middle" fontSize="8.8" fontWeight="700" fontFamily="sans-serif">小红书</text></svg>
}

export function SocialLinks({ preview = false, centerId = 'platform' }: { preview?: boolean; centerId?: string }) {
  return connectedMode ? <ServerSocial/> : <DemoSocialLinks preview={preview} centerId={centerId}/>
}
function DemoSocialLinks({ preview = false, centerId = 'platform' }: { preview?: boolean; centerId?: string }) {
  const [accounts, setAccounts] = useState(() => { try { return preview ? readSocialPreview(localStorage.getItem(socialPreviewKey(centerId)), centerId) : emptySocialAccounts(centerId) } catch { return emptySocialAccounts(centerId) } })
  useEffect(() => {
    if (!preview) return
    const update = () => { try { setAccounts(readSocialPreview(localStorage.getItem(socialPreviewKey(centerId)), centerId)) } catch { /* Retain last valid preview. */ } }
    window.addEventListener('storage', update); window.addEventListener('xiangqiao-social-preview', update)
    return () => { window.removeEventListener('storage', update); window.removeEventListener('xiangqiao-social-preview', update) }
  }, [preview, centerId])
  return <div className="xq-social" aria-label="乡桥官方社交账号"><span>关注乡桥{preview && centerId !== 'platform' ? ' · 中心账号预览' : ''}</span><div>{socialPlatforms.map(item => {
    const account = accounts.find(a => a.id === item.id)
    return account?.enabled && account.href
      ? <a key={item.id} href={account.href} target="_blank" rel="noopener noreferrer" aria-label={`${item.name}：${account.accountName}`}><SocialIcon id={item.id}/><span>{item.name}</span></a>
      : <button key={item.id} type="button" disabled aria-label={`${item.name}：官方账号待配置`} title="官方账号尚未配置或未启用"><SocialIcon id={item.id}/><span>{item.name}</span><small>待配置</small></button>
  })}</div></div>
}
