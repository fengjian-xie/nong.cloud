import { Check, Info, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useFarm } from './FarmProvider'

export function FarmPage({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  const { notice, storageWarning } = useFarm()
  return <div className="farm-page"><div className="page-heading"><div><div className="farm-eyebrow">乡桥农事 · 福安试点</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
    <div className="farm-demo"><Info size={16}/><span>前端演示 · 操作保存在本机，未接入实物卡、支付或外部平台。示例数据基准日 2026-08-29。</span></div>
    {storageWarning && <p className="farm-warning" role="alert">{storageWarning}</p>}
    {notice && <div className="farm-feedback" role="status"><Check size={15}/>{notice}</div>}
    {children}</div>
}
export function Stats({ items }: { items: { label: string; value: string | number; detail: string }[] }) {
  return <div className="farm-stats">{items.map(item => <article className="panel" key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></article>)}</div>
}
export function Tag({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'amber' | 'gray' | 'red' }) {
  return <span className={`farm-tag ${tone}`}>{children}</span>
}
export function Panel({ title, caption, action, children }: { title: string; caption?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="panel farm-panel"><div className="panel-head"><div><h2>{title}</h2>{caption && <p>{caption}</p>}</div>{action}</div>{children}</section>
}
export function Table({ headers, children, empty }: { headers: string[]; children: ReactNode; empty?: boolean }) {
  return <div className="data-table-wrap farm-table-wrap" tabIndex={0} aria-label="可横向滚动的数据表"><table className="data-table farm-table"><thead><tr>{headers.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{empty ? <tr><td colSpan={headers.length}><div className="farm-empty"><Search size={24}/>没有匹配的数据，请调整筛选条件</div></td></tr> : children}</tbody></table></div>
}
export function SearchField({ value, onChange, placeholder = '搜索编号、名称或主体' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="search-box farm-search"><Search size={17}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}/></label>
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    dialog?.showModal(); document.body.style.overflow = 'hidden'
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  return <dialog ref={ref} className="farm-modal" aria-label={title} onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === ref.current) { const bounds = ref.current.getBoundingClientRect(); if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) onClose() } }}><div className="farm-modal-head"><h2>{title}</h2><button className="icon-button" aria-label="关闭窗口" onClick={onClose}><X size={20}/></button></div><div className="farm-modal-body">{children}</div></dialog>
}
export function PlotSelect({ value, onChange, label = '选择地块' }: { value: string; onChange: (value: string) => void; label?: string }) {
  const { state } = useFarm()
  return <label>{label}<select value={value} onChange={e => onChange(e.target.value)}>{state.plots.map(p => <option key={p.id} value={p.id}>{p.name} · {p.owner}</option>)}</select></label>
}
export function AuditTrail() {
  const { state } = useFarm()
  return <Panel title="本地操作留痕" caption="记录演示操作；正式环境需服务端鉴权和不可篡改审计存储"><div className="farm-audit">{state.audit.length ? state.audit.slice(0, 8).map(a => <div key={a.id}><time>{a.at}</time><span>{a.message}</span></div>) : <p>暂无操作；完成核验、配置或库存操作后会显示在这里。</p>}</div></Panel>
}
export function FarmOverview() {
  const { state } = useFarm()
  const pending = state.records.filter(r => r.status === '待核验').length
  return <section className="farm-overview"><div><span className="farm-overview-kicker">NONG.CLOUD / 乡桥农事中心</span><h2>从一张记录卡，到一季好收成。</h2><p>赛岐镇狮子头村 · 首年500亩葡萄是覆盖目标，以下为演示样本。</p><div className="farm-overview-links"><Link to="/cards">管理农事卡 →</Link><Link to="/maturity">查看成熟一览 →</Link><Link to="/trace">追溯报送预检 →</Link></div></div><div className="farm-overview-counts"><Link to="/cards"><strong>{state.cards.filter(c => c.status === '已激活').length}</strong><span>已激活样卡</span></Link><Link to="/records?status=待核验"><strong>{pending}</strong><span>记录待核验</span></Link><Link to="/production"><strong>{state.plots.reduce((s, p) => s + p.area, 0).toFixed(1)}</strong><span>示例面积 / 亩</span></Link></div></section>
}
// eslint-disable-next-line react-refresh/only-export-components
export function useSearchRows<T>(rows: T[]) {
  const [query, setQuery] = useState('')
  const visible = query ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(query.trim().toLowerCase())) : rows
  return { query, setQuery, visible }
}
