import { useEffect, useState } from 'react'
import { request } from './client'
import { SocialIcon } from '../home/SocialLinks'
type PublicNews = { id: string; title: string; body: string; publishedAt: string; centerName: string }
const center = import.meta.env.VITE_PUBLIC_CENTER_ID || 'local-fuan'
export function ServerNews() {
  const [articles, setArticles] = useState<PublicNews[]>([]), [error, setError] = useState('')
  useEffect(() => { const c = new AbortController(); request<PublicNews[]>('/public/news?center=' + encodeURIComponent(center), { signal: c.signal }).then(setArticles).catch(() => { if (!c.signal.aborted) setError('新闻接口暂不可用，未使用示例资讯代替。') }); return () => c.abort() }, [])
  return <section id="news" className="xq-wrap xq-section xq-news"><div className="xq-section-heading"><h2>乡桥新闻与动态。</h2><p>仅展示服务端已发布资讯。</p></div>{error && <p role="alert">{error}</p>}<div className="xq-news-grid">{articles.map(a => <article key={a.id}><small>{a.centerName} · {a.publishedAt.slice(0, 10)}</small><h3>{a.title}</h3>{a.body.split('\n').map((p, i) => <p key={i}>{p}</p>)}</article>)}</div>{!error && !articles.length && <p>暂无已发布资讯。</p>}</section>
}
export function ServerSocial() {
  const [accounts, setAccounts] = useState<{ channel: string; displayName: string; url: string }[]>([])
  useEffect(() => { const c = new AbortController(); request<typeof accounts>('/public/site-config?center=' + encodeURIComponent(center), { signal: c.signal }).then(setAccounts).catch(() => {}); return () => c.abort() }, [])
  return <div className="xq-social" aria-label="乡桥官方社交账号"><span>关注乡桥</span><div>{accounts.map(a => <a key={a.channel} href={a.url} target="_blank" rel="noopener noreferrer"><SocialIcon id={a.channel === 'wechat_video' ? 'video' : a.channel === 'douyin' ? 'douyin' : 'xiaohongshu'}/><span>{a.displayName}</span></a>)}{!accounts.length && <span>官方账号尚未启用或接口暂不可用</span>}</div></div>
}
