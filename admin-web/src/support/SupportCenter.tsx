import { useState } from 'react'
import type { FormEvent } from 'react'
import { Headphones, Phone, Send } from 'lucide-react'
import { categories, createTicket, faqs, methods, parseTickets, sameOwner, seedQueue, statuses, storageKey, teams, transition } from './model'
import type { SupportIdentity, SupportTicket } from './model'
import './support.css'

export function SupportCenter({ mode = 'user', owner }: { mode?: 'user' | 'admin'; owner: SupportIdentity }) {
  const key = storageKey(mode, owner)
  const [initial] = useState(() => { try { return { tickets: parseTickets(localStorage.getItem(key)) ?? (mode === 'admin' ? seedQueue() : []), warning: '' } } catch { return { tickets: mode === 'admin' ? seedQueue() : [], warning: '储存不可用，仅当前页面有效。' } } })
  const [tickets, setTickets] = useState(initial.tickets)
  const [notice, setNotice] = useState(initial.warning)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('全部')
  const [selectedId, setSelectedId] = useState('')
  const [category, setCategory] = useState<string>(categories[0])
  const [method, setMethod] = useState<string>(methods[0])
  const [description, setDescription] = useState('')
  const [team, setTeam] = useState<string>(teams[1])
  const [reply, setReply] = useState('')
  const scoped = mode === 'admin' ? tickets : tickets.filter(t => sameOwner(t, owner))
  const selected = scoped.find(t => t.id === selectedId)
  const visible = scoped.filter(t => filter === '全部' || t.status === filter)
  function commit(next: SupportTicket[], message: string) {
    try { localStorage.setItem(key, JSON.stringify({ version: 1, tickets: next })); setNotice(message) }
    catch { setNotice(`${message} 储存不可用，仅当前页面有效。`) }
    setTickets(next); setError('')
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    try { if (scoped.length >= 100) throw new Error('本地演示最多100条，请勿重复登记。'); const ticket = createTicket(owner, category, method, description, scoped.length); commit([ticket, ...scoped], '本地帮助登记已保存，未提交真实中心，也未预约或拨打电话。'); setSelectedId(ticket.id); setDescription('') } catch (err) { setError(err instanceof Error ? err.message : '保存失败') }
  }
  function action(type: 'assign' | 'reply' | 'confirm' | 'reopen') {
    if (!selected) return
    try { const next = transition(selected, type === 'assign' ? { type, team } : type === 'reply' ? { type, text: reply } : { type, owner }); commit(tickets.map(t => t.id === selected.id ? next : t), '演示状态已更新；没有真实通知、回访、验收或退款。'); setReply('') } catch (err) { setError(err instanceof Error ? err.message : '状态更新失败') }
  }
  return <section className="support-center">
    <header className="support-heading"><div><span>乡桥 · 统一帮助服务</span><h1>{mode === 'admin' ? '帮助呼叫中心 · 受理中台' : '遇到问题，乡桥帮你。'}</h1><p>{mode === 'admin' ? '服务种植户、消费者和各经营主体，统一受理、分派、跟进与回访。' : `${owner.label} · 常见问题、帮助登记和处理进度。`}</p></div><Headphones size={36}/></header>
    <div className="support-disclaimer">演示：热线、坐席、服务时间待配置；数据仅在本机。PC各站与小程序队列尚未通过后端互通，不真实拨号、录音、预约或发送通知。种植户与消费者不收平台帮助服务费。</div>
    {notice && <p className="support-notice" role="status">{notice}</p>}{error && <p className="support-error" role="alert">{error}</p>}
    <div className="support-grid"><section className="support-panel"><h2>{mode === 'admin' ? '服务台规则与知识库' : '常见问题'}</h2>{faqs.map(f => <details key={f.title}><summary>{f.title}</summary><p>{f.answer}</p></details>)}<button className="support-secondary" onClick={() => setNotice('真实热线、服务时间和回访坐席待配置，当前没有发起电话。')}><Phone size={16}/>人工帮助与回访说明</button><p className="support-small">紧急人身安全问题不要等待平台工单。专业建议、争议复核、退款和支付权限独立处理。</p></section>
      {mode === 'user' ? <section className="support-panel"><h2>登记问题或回访意向</h2><form onSubmit={submit}><label>问题类型<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label>希望怎样回复<select value={method} onChange={e => setMethod(e.target.value)}>{methods.map(m => <option key={m}>{m}</option>)}</select></label><label>问题说明（仅测试）<textarea rows={5} maxLength={1000} value={description} onChange={e => { setDescription(e.target.value); setError('') }} placeholder="8–1000字，勿填真实电话、邮箱、密钥等"/></label><button className="support-primary" type="submit"><Send size={16}/>保存本地帮助登记</button></form></section> : <section className="support-panel"><h2>受理与协同边界</h2><ol><li>核对提问主体及对象授权，不向客服开放全量农户档案。</li><li>按卡片、生产、履约、产销、消费等类型分派，不因角色切换扩大权限。</li><li>坐席只能协助和记录，不能自行验收、改库存、执行退款或分账。</li><li>回复后待用户确认；未解决可重开。回访意向不是已完成通话。</li></ol><p className="support-small">当前为虚构队列。正式上线需中心排班、服务时限、权限、联系方式授权和业务后端。</p></section>}
    </div>
    <section className="support-panel"><div className="support-list-heading"><h2>{mode === 'admin' ? '中心演示受理队列' : '当前身份处理进度'}</h2><label>筛选状态<select value={filter} onChange={e => { setFilter(e.target.value); setSelectedId('') }}><option>全部</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></label></div><div className="support-tickets">{visible.length ? visible.map(t => <button key={t.id} className={selectedId === t.id ? 'selected' : ''} onClick={() => { setSelectedId(t.id); setError(''); setReply(''); setTeam(t.team === '待分派' ? teams[1] : t.team) }}><strong>{t.category}</strong><span>{t.owner.label} · {t.status}</span><small>{t.team} · {t.method}</small></button>) : <p className="support-small">暂无符合条件的帮助记录。</p>}</div>
      {selected && <article className="support-detail"><h3>{selected.category} · {selected.status}</h3><p>{selected.description}</p><ol>{selected.timeline.map((line, i) => <li key={i}>{line}</li>)}</ol>{selected.reply && <p className="support-notice">演示回复：{selected.reply}</p>}
      {mode === 'admin' ? <>{['待受理', '处理中'].includes(selected.status) && <div className="support-actions"><label>受理队列<select value={team} onChange={e => setTeam(e.target.value)}>{teams.filter(t => t !== '待分派').map(t => <option key={t}>{t}</option>)}</select></label><button className="support-secondary" onClick={() => action('assign')}>演示受理与分派</button></div>}{selected.status === '处理中' && <div className="support-reply"><label>处理说明（仅测试）<textarea rows={3} maxLength={1000} value={reply} onChange={e => setReply(e.target.value)}/></label><button className="support-primary" onClick={() => action('reply')}>演示回复，待用户确认</button></div>}{selected.status === '待用户确认' && <p className="support-small">坐席不能代替用户确认解决；真实消息和回访尚未接入。</p>}</> : <div className="support-actions">{selected.status === '待用户确认' && <button className="support-primary" onClick={() => action('confirm')}>确认问题已解决（演示）</button>}{['待用户确认', '已关闭'].includes(selected.status) && <button className="support-secondary" onClick={() => action('reopen')}>未解决，重新受理（演示）</button>}</div>}</article>}
    </section>
  </section>
}
export default function AdminSupportCenter() { return <SupportCenter mode="admin" owner={{ accountId: 'admin-support-demo', identityId: 'center-support-demo', label: '中心坐席（演示）' }}/> }
