import { ArrowRight, Newspaper } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ContentDialog } from '../components/ContentDialog'
import { initialNews, newsCategories, publishedNews, publicNewsPreviewKey, readPublicNewsPreview, type NewsArticle } from '../content/news'
import '../content/content.css'
import './news.css'
import { connectedMode } from '../connected/client'
import { ServerNews } from '../connected/PublicContent'

export function NewsSection({ preview = false }: { preview?: boolean }) {
  return connectedMode ? <ServerNews/> : <DemoNewsSection preview={preview}/>
}
function DemoNewsSection({ preview = false }: { preview?: boolean }) {
  function readArticles() {
    if (!preview) return publishedNews(initialNews)
    try { return readPublicNewsPreview(localStorage.getItem(publicNewsPreviewKey)) } catch { return publishedNews(initialNews) }
  }
  const [articles, setArticles] = useState(readArticles)
  const [category, setCategory] = useState('全部资讯')
  const [selected, setSelected] = useState<NewsArticle | null>(null)
  useEffect(() => {
    if (!preview) return
    const update = () => {
      try { setArticles(readPublicNewsPreview(localStorage.getItem(publicNewsPreviewKey))) } catch { /* Keep current public preview when storage is blocked. */ }
    }
    window.addEventListener('storage', update)
    window.addEventListener('xiangqiao-news-preview', update)
    return () => { window.removeEventListener('storage', update); window.removeEventListener('xiangqiao-news-preview', update) }
  }, [preview])
  const visible = articles.filter(a => category === '全部资讯' || a.category === category)
  return <section id="news" className="xq-wrap xq-section xq-news" aria-labelledby="news-title">
    <div className="xq-section-heading"><span className="xq-news-kicker"><Newspaper size={18}/> NEWS & UPDATES</span><h2 id="news-title">乡桥新闻与动态。</h2><p>关注乡桥的产品建设、服务说明与产业带观察。</p></div>
    <div className="xq-news-filters" aria-label="新闻栏目">{['全部资讯', ...newsCategories].map(c => <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div>
    <div className="xq-news-grid">{visible.map(a => <article key={a.id}><div className="xq-news-meta"><span>{a.category}</span><time dateTime={a.date}>{a.date} · 示例资讯</time></div><h3>{a.title}</h3><p>{a.summary}</p><button className="xq-news-read" onClick={() => setSelected(a)} aria-label={`阅读全文：${a.title}`}>阅读全文<ArrowRight size={17}/></button></article>)}</div>
    {!visible.length ? <p className="xq-news-empty">这个栏目暂无公开资讯，可切换其他栏目查看。</p> : null}
    <p className="xq-news-note">当前为基于项目已确认口径的示例内容，不代表已完成建设、量产、获得补贴或法定认证。{preview ? '本地预览可展示后台独立审核后的演示稿；未审核草稿不展示，线上跨域发布需服务端接入。' : '正式新闻发布能力待接入。'}</p>
    {selected ? <ContentDialog title={selected.title} onClose={() => setSelected(null)}><p className="news-meta">{selected.category} · {selected.date} · 示例资讯</p><p className="news-summary">{selected.summary}</p>{selected.body.split('\n').map((p, index) => <p key={index}>{p}</p>)}<p className="xq-news-note">本文为项目说明示例，不作为资质、经营成果或实际交付证明。</p></ContentDialog> : null}
  </section>
}
