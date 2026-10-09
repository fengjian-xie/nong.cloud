import { FileClock, PlugZap, ShieldCheck, Newspaper, ArrowRight, Download, Plus, Save, Search, ExternalLink, Building2, Radio, UsersRound } from 'lucide-react'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ContentDialog } from '../components/ContentDialog'
import { PaginationBar } from '../components/PaginationBar'
import { Stats, Table, Tag } from '../farm/ui'
import { downloadText } from '../home/download'
import { newsCategories, publishedNews, publicNewsPreviewKey, type NewsArticle } from '../content/news'
import { socialPlatforms, socialPreviewKey, type SocialAccount } from '../content/social'
import { SocialIcon } from '../home/SocialLinks'
import { identityIndustries, identityTemplates, type BusinessIdentityDefinition } from './identity'
import { applySystemAction, centerScopes, createSystemState, logCategories, logLevels, logsCsv, makeActor, parseSystemState, permissionCatalog, permissionGroups, roleTemplates, systemStorageKey, type Administrator, type AuditEntry, type Integration, type Organization, type PermissionId, type ScopeId, type SystemAction, type SystemState } from './model'
import './system.css'
import '../content/content.css'

const SystemNotice = createContext('')
function SystemDialog(props: { title: string; onClose: () => void; children: ReactNode }) {
  const notice = useContext(SystemNotice)
  return <ContentDialog {...props} notice={notice}/>
}

export type SystemView = 'logs' | 'integrations' | 'permissions' | 'news' | 'social' | 'centers' | 'identities'
const views = {
  logs: { title: '日志中心', description: '统一查看操作留痕、接口接入记录与安全事件', icon: FileClock },
  integrations: { title: '第三方接口', description: '按服务中心维护接入清单、授权边界与同步记录', icon: PlugZap },
  permissions: { title: '管理员权限设置', description: '岗位、服务中心范围与独立审批，分别控制', icon: ShieldCheck },
  news: { title: '新闻管理', description: '从草稿到独立审核，管理官网新闻与公告', icon: Newspaper },
  social: { title: '社交账号设置', description: '视频号、抖音、小红书按平台与服务中心分别配置', icon: Radio },
  centers: { title: '公司与服务中心', description: '平台总公司、区县运营主体与乡镇服务站的组织目录', icon: Building2 },
  identities: { title: '产区身份设置', description: '业务身份按产区扩展，复用流程模板，不创建新的后台架构', icon: UsersRound },
}
const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })

export default function SystemManagementPage({ view }: { view: SystemView }) {
  const { session } = useAuth()
  if (!session) return null
  return <ManagementContent key={`${session.user.id}:${view}`} view={view} user={session.user}/>
}

function ManagementContent({ view, user }: { view: SystemView; user: { id: string; name: string; role: string } }) {
  const { pathname } = useLocation()
  const actor = makeActor(user)
  const cacheKey = systemStorageKey(actor.tenant, actor.accountId)
  const [state, setState] = useState<SystemState>(() => {
    try { return parseSystemState(localStorage.getItem(cacheKey), actor) } catch { return createSystemState(actor) }
  })
  const [notice, setNotice] = useState('')
  function act(action: SystemAction) {
    try {
      const next = applySystemAction(state, action, actor)
      setState(next)
      let message = next.logs[0].detail
      try {
        localStorage.setItem(cacheKey, JSON.stringify(next))
        if (action.type.startsWith('news.')) {
          localStorage.setItem(publicNewsPreviewKey, JSON.stringify({ version: 1, articles: publishedNews(next.news).map(a => ({ ...a, authorId: 'public-demo-author', author: '乡桥内容编辑（公开示例）', contributors: undefined })) }))
          window.dispatchEvent(new Event('xiangqiao-news-preview'))
        }
        if (action.type === 'social.save') {
          const centerId = action.account.centerId
          localStorage.setItem(socialPreviewKey(centerId), JSON.stringify({ version: 1, centerId, accounts: next.socials.filter(a => a.centerId === centerId) }))
          window.dispatchEvent(new Event('xiangqiao-social-preview'))
        }
      } catch { message += ' 本地储存不可用，本次更改仅在当前页面保留。' }
      setNotice(message)
      return true
    } catch (error) { setNotice(error instanceof Error ? error.message : '演示操作失败'); return false }
  }
  const config = views[view]
  const Icon = config.icon
  const allowed = actor.permissions.includes(({ logs: 'logs.read', integrations: 'integrations.read', permissions: 'admins.read', news: 'news.read', social: 'socials.read', centers: 'centers.read', identities: 'identities.read' } as const)[view])
  return <SystemNotice.Provider value={notice}><div className="sys-page">
    <div className="page-heading"><div><div className="sys-eyebrow">系统管理 / 福安市中心</div><h1><Icon size={26}/>{config.title}</h1><p>{config.description}</p></div><span className="sys-context">当前账号：{actor.name}</span></div>
    <div className="sys-demo">本机演示 · 不是服务器日志或生产权限。没有真实第三方请求、密钥托管、账号授权或跨域发布。</div>
    {!pathname.startsWith('/manage/') ? <nav className="sys-subnav" aria-label="系统模块">{Object.entries(views).map(([id, item]) => <Link key={id} to={`/settings/${id}`} aria-current={view === id ? 'page' : undefined}>{item.title}<ArrowRight size={14}/></Link>)}</nav> : null}
    {notice ? <div className="sys-feedback" role="status">{notice}</div> : null}
    {!allowed ? <section className="panel sys-panel"><h2>当前演示岗位无查看权限</h2><p>请由具有对应权限的管理员处理；不要通过切换业务身份提权。</p></section> : <>
      {view === 'logs' ? <LogsView logs={state.logs} act={act} canExport={actor.permissions.includes('logs.export')}/> : null}
      {view === 'integrations' ? <IntegrationsView integrations={state.integrations} logs={state.logs} act={act} canManage={actor.permissions.includes('integrations.manage')}/> : null}
      {view === 'permissions' ? <PermissionsView state={state} actorId={actor.accountId} act={act} canManage={actor.permissions.includes('admins.manage')}/> : null}
      {view === 'news' ? <NewsView articles={state.news} actorId={actor.accountId} act={act} canEdit={actor.permissions.includes('news.edit')} canReview={actor.permissions.includes('news.review')}/> : null}
      {view === 'social' ? <SocialView state={state} act={act} canManage={actor.permissions.includes('socials.manage')} platformManager={actor.permissions.includes('centers.manage')} scope={actor.scope}/> : null}
      {view === 'centers' ? <CentersView organizations={state.organizations} actorId={actor.accountId} act={act} canApply={actor.permissions.includes('centers.apply')} canApprove={actor.permissions.includes('centers.manage')}/> : null}
      {view === 'identities' ? <IdentitiesView definitions={state.identities} centerId={actor.tenant} act={act} canManage={actor.permissions.includes('identities.manage')}/> : null}
    </>}
  </div></SystemNotice.Provider>
}

type ActionRunner = (action: SystemAction) => boolean
function FilterField({ label, children }: { label: string; children: ReactNode }) { return <label className="sys-filter"><span>{label}</span>{children}</label> }
function SearchBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="sys-search"><Search size={17}/><input aria-label={label} placeholder={label} value={value} onChange={event => onChange(event.target.value)}/></label> }

function LogsView({ logs, act, canExport }: { logs: AuditEntry[]; act: ActionRunner; canExport: boolean }) {
  const [query, setQuery] = useState(''), [category, setCategory] = useState('全部'), [level, setLevel] = useState('全部')
  const [date, setDate] = useState(''), [selected, setSelected] = useState<AuditEntry | null>(null), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(20)
  const filtered = logs.filter(l => (category === '全部' || l.category === category) && (level === '全部' || l.level === level)
    && (!date || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date(l.at)) === date)
    && `${l.actor} ${l.action} ${l.target} ${l.traceId}`.toLowerCase().includes(query.trim().toLowerCase()))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  function reset() { setQuery(''); setCategory('全部'); setLevel('全部'); setDate(''); setPage(1) }
  return <>
    <Stats items={[{ label: '本机记录', value: logs.length, detail: '示例与当前账号的本地操作' }, { label: '安全与异常提示', value: logs.filter(l => l.level !== '信息').length, detail: '不是线上错误或告警统计' }, { label: '日志保护', value: '只读展示', detail: '无修改、清空或删除日志入口' }]}/>
    <section className="panel"><div className="panel-head"><div><h2>日志明细</h2><p>覆盖新模块的本地操作；服务器日志及旧业务审计待接入</p></div><button className="secondary-button" disabled={!canExport} onClick={() => { const csv = logsCsv(filtered); if (act({ type: 'logs.export', count: filtered.length })) downloadText('乡桥演示日志.csv', csv) }}><Download size={16}/>导出演示CSV</button></div>
      <div className="sys-toolbar"><SearchBox label="搜索操作、对象、操作者或追踪ID" value={query} onChange={value => { setQuery(value); setPage(1) }}/>
        <FilterField label="日志类别"><select value={category} onChange={e => { setCategory(e.target.value); setPage(1) }}><option>全部</option>{logCategories.map(c => <option key={c}>{c}</option>)}</select></FilterField>
        <FilterField label="日志级别"><select value={level} onChange={e => { setLevel(e.target.value); setPage(1) }}><option>全部</option>{logLevels.map(l => <option key={l}>{l}</option>)}</select></FilterField>
        <FilterField label="日志日期（北京时间）"><input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1) }}/></FilterField><button className="secondary-button" onClick={reset}>重置筛选</button></div>
      <Table headers={['时间（北京时间）', '类别 / 级别', '操作者', '操作与对象', '结果', '详情']} empty={!filtered.length}>{filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(l => <tr key={l.id}><td>{formatTime(l.at)}</td><td>{l.category}<br/><Tag tone={l.level === '信息' ? 'gray' : l.level === '错误' ? 'red' : 'amber'}>{l.level}</Tag></td><td>{l.actor}</td><td><strong>{l.action}</strong><small>{l.target}</small></td><td>{l.result}</td><td><button className="sys-link" onClick={() => setSelected(l)}>查看日志</button></td></tr>)}</Table>
      <PaginationBar total={filtered.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={value => { setPageSize(value); setPage(1) }}/>
    </section>
    {selected ? <SystemDialog title="日志详情" onClose={() => setSelected(null)}><p><strong>{selected.action}</strong> · {selected.result}</p><dl className="sys-definition"><dt>追踪ID</dt><dd>{selected.traceId}</dd><dt>时间</dt><dd>{formatTime(selected.at)}</dd><dt>操作者</dt><dd>{selected.actor}</dd><dt>业务对象</dt><dd>{selected.target}</dd></dl><p>{selected.detail}</p><p className="sys-hint">本地留痕可被浏览器使用者更改，不具备生产审计证明效力；正式日志应服务端鉴权、脱敏和追加写入。</p></SystemDialog> : null}
  </>
}

function IntegrationsView({ integrations, logs, act, canManage }: { integrations: Integration[]; logs: AuditEntry[]; act: ActionRunner; canManage: boolean }) {
  const [query, setQuery] = useState(''), [category, setCategory] = useState('全部'), [editing, setEditing] = useState<Integration | null>(null), [details, setDetails] = useState<Integration | null>(null)
  const categories = [...new Set(integrations.map(i => i.category))]
  const filtered = integrations.filter(i => (category === '全部' || i.category === category) && `${i.name} ${i.owner}`.includes(query.trim()))
  return <>
    <Stats items={[{ label: '接入清单', value: integrations.length, detail: '按实际授权与机构规范实施' }, { label: '本地配置', value: integrations.filter(i => i.status === '本地已配置').length, detail: '不代表真实连接成功' }, { label: '凭据保护', value: '服务端托管', detail: '此页面不填写或保存真实密钥' }]}/>
    <div className="sys-toolbar"><SearchBox label="搜索接口或负责人" value={query} onChange={setQuery}/><FilterField label="接口类别"><select value={category} onChange={e => setCategory(e.target.value)}><option>全部</option>{categories.map(c => <option key={c}>{c}</option>)}</select></FilterField></div>
    <div className="sys-catalog">{filtered.map(i => <article className="panel sys-integration" key={i.id}><div className="sys-card-head"><span className="sys-card-icon"><PlugZap size={23}/></span><Tag tone={i.status === '未配置' ? 'gray' : 'amber'}>{i.status}</Tag></div><small>{i.category}</small><h2>{i.name}</h2><p>{i.description}</p><div className="sys-card-meta"><span>负责人</span><strong>{i.owner}</strong></div><div className="sys-card-actions"><button className="sys-link" onClick={() => setDetails(i)}>接入说明</button><button className="secondary-button" disabled={!canManage} onClick={() => setEditing({ ...i })}>配置接口</button></div></article>)}</div>
    {!filtered.length ? <p className="sys-empty">没有匹配接口，请调整搜索或分类。</p> : null}
    {details ? <SystemDialog title={`${details.name} · 接入说明`} onClose={() => setDetails(null)}><p>{details.dataScope}</p><p>本地状态：{details.status}。授权方式：{details.authorization}。</p><p className="sys-hint">格式检查和演示同步不发起网络请求。真实接口需服务器鉴权、凭据托管、签名验签、幂等、防重放、回执和人工纠错；微信支付、分账与退款不能由浏览器执行。</p><h3>该接口的本地记录</h3>{logs.filter(l => l.target === details.name).slice(0, 6).map(l => <p key={l.id}>{formatTime(l.at)} · {l.action} · {l.result}</p>)}<div className="sys-actions"><button className="secondary-button" disabled={!canManage} onClick={() => { if (act({ type: 'integration.check', id: details.id })) setDetails(null) }}>本地格式检查</button><button className="secondary-button" disabled={!canManage} onClick={() => { if (act({ type: 'integration.queue', id: details.id })) setDetails(null) }}>登记演示同步任务</button><button className="secondary-button" disabled={!canManage || details.status !== '本地已配置'} onClick={() => { if (act({ type: 'integration.pause', id: details.id })) setDetails(null) }}>停用本地配置</button></div></SystemDialog> : null}
    {editing ? <SystemDialog title={`${editing.name} · 配置接口`} onClose={() => setEditing(null)}><form className="sys-form" onSubmit={e => { e.preventDefault(); if (act({ type: 'integration.save', id: editing.id, endpoint: editing.endpoint, owner: editing.owner, authorization: editing.authorization })) setEditing(null) }}>
      <label>HTTPS接口地址（仅演示）<input value={editing.endpoint} maxLength={300} placeholder="https://provider.example.invalid/api" onChange={e => setEditing({ ...editing, endpoint: e.target.value })}/></label><p className="sys-hint">只填写不含凭据的公网地址；不要填真实令牌、内网IP或带密钥的查询参数。</p>
      <label>演示负责人<input value={editing.owner} maxLength={50} onChange={e => setEditing({ ...editing, owner: e.target.value })}/></label>
      <label>授权方式<select value={editing.authorization} onChange={e => setEditing({ ...editing, authorization: e.target.value })}><option>机构授权（待接入）</option><option>服务端凭据托管（待接入）</option></select></label><p>凭据状态：未托管。正式密钥、证书与OAuth令牌仅允许后端安全配置，不在浏览器或日志中保存。</p>
      <div className="sys-actions"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>取消</button><button className="primary-inline"><Save size={16}/>保存本地配置</button></div></form></SystemDialog> : null}
  </>
}

function PermissionsView({ state, actorId, act, canManage }: { state: SystemState; actorId: string; act: ActionRunner; canManage: boolean }) {
  const [editing, setEditing] = useState<Administrator | null>(null), [reason, setReason] = useState(''), [template, setTemplate] = useState('county')
  function togglePermission(id: PermissionId) {
    if (!editing) return
    setEditing({ ...editing, permissions: editing.permissions.includes(id) ? editing.permissions.filter(p => p !== id) : [...editing.permissions, id] })
  }
  return <>
    <Stats items={[{ label: '示例管理员', value: state.administrators.length, detail: '后台岗位与农户业务身份独立' }, { label: '待独立审批', value: state.requests.filter(r => r.status === '待审批').length, detail: '不能审批本人申请' }, { label: '权限边界', value: '岗位 × 范围', detail: '不能超出自身授权能力提权' }]}/>
    <section className="panel"><div className="panel-head"><div><h2>管理员与服务中心</h2><p>不授予真实登录权限；权限修改保留版本与独立审批</p></div><Tag tone="gray">前端权限模拟</Tag></div><Table headers={['管理员', '岗位', '服务中心范围', '权限', '操作']}>{state.administrators.map(a => <tr key={a.id}><td><strong>{a.name}</strong><small>{a.accountId === actorId ? '当前账号 · 不可自行修改' : `示例账号 ${a.id}`}</small></td><td>{roleTemplates.find(r => r.id === a.roleId)?.name}</td><td>{centerScopes.find(s => s.id === a.scope)?.name}</td><td>{a.permissions.length} 项 · v{a.revision}</td><td><button className="sys-link" disabled={!canManage || a.accountId === actorId} onClick={() => { setEditing(structuredClone(a)); setReason('') }}>调整权限</button></td></tr>)}</Table></section>
    <section className="panel sys-panel"><div className="sys-section-head"><div><h2>岗位权限模板</h2><p>查看和操作分开，财务、客服、内容与接口经办各司其职。</p></div><FilterField label="查看岗位模板"><select value={template} onChange={e => setTemplate(e.target.value)}>{roleTemplates.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></FilterField></div><div className="sys-permission-groups">{permissionGroups.map(group => <fieldset key={group}><legend>{group}</legend>{permissionCatalog.filter(p => p.group === group).map(p => <label key={p.id}><input type="checkbox" checked={!!roleTemplates.find(r => r.id === template)?.permissions.includes(p.id)} readOnly disabled/>{p.name}</label>)}</fieldset>)}</div></section>
    <section className="panel sys-panel"><h2>权限变更审批</h2><p className="sys-hint">本人申请不可自批；审批前复核服务中心、授权能力和原权限版本。这里的通过只影响本机演示，生产RBAC仍待服务端实现。</p>{state.requests.map(r => <article className="sys-request" key={r.id}><div><strong>{state.administrators.find(a => a.id === r.targetId)?.name} · {r.status}</strong><p>{r.reason}</p><small>{r.requesterId === actorId ? '当前账号申请，等待其他管理员审批' : '其他示例账号发起'} · {r.permissions.length}项权限</small></div><button className="secondary-button" disabled={!canManage || r.requesterId === actorId || state.administrators.find(a => a.id === r.targetId)?.accountId === actorId || r.status !== '待审批'} onClick={() => act({ type: 'permission.approve', id: r.id })}>审批演示申请</button></article>)}</section>
    {editing ? <SystemDialog title={`${editing.name} · 调整权限`} onClose={() => setEditing(null)}><form className="sys-form" onSubmit={e => { e.preventDefault(); if (act({ type: 'permission.request', targetId: editing.id, roleId: editing.roleId, scope: editing.scope, permissions: editing.permissions, reason })) setEditing(null) }}><label>管理员岗位<select value={editing.roleId} onChange={e => setEditing({ ...editing, roleId: e.target.value, permissions: [...roleTemplates.find(r => r.id === e.target.value)!.permissions] })}>{roleTemplates.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>服务中心范围<select value={editing.scope} onChange={e => setEditing({ ...editing, scope: e.target.value as ScopeId })}>{centerScopes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div className="sys-permission-groups">{permissionGroups.map(group => <fieldset key={group}><legend>{group}</legend>{permissionCatalog.filter(p => p.group === group).map(p => <label key={p.id}><input type="checkbox" checked={editing.permissions.includes(p.id)} onChange={() => togglePermission(p.id)}/>{p.name}</label>)}</fieldset>)}</div><label>变更理由（仅测试）<textarea value={reason} minLength={8} maxLength={240} required onChange={e => setReason(e.target.value)} placeholder="说明岗位需要和服务中心范围，不填写真实个人信息"/></label><p className="sys-hint">不能授予超出自身授权能力的权限；查看依赖须完整。提交后原权限不改变，等待独立管理员审批。</p><button className="primary-inline">提交权限审批申请</button></form></SystemDialog> : null}
  </>
}

function IdentitiesView({ definitions, centerId, act, canManage }: { definitions: BusinessIdentityDefinition[]; centerId: string; act: ActionRunner; canManage: boolean }) {
  const [industry, setIndustry] = useState('全部'), [editing, setEditing] = useState<BusinessIdentityDefinition | null>(null)
  const rows = definitions.filter(d => industry === '全部' || d.industry === industry)
  return <>
    <section className="panel sys-panel"><div className="sys-section-head"><div><h2>基础业务模板 + 产区特色身份</h2><p>例如葡萄修剪队、套袋队复用农服履约；新名字不改变独立验收、数据归属和必要准入要求。</p></div><button className="primary-inline" disabled={!canManage} onClick={() => setEditing({ id: `identity-${Date.now().toString(36)}`, centerId, name: '', industry: '葡萄产区', templateId: 'team', admission: '', status: '待发布草案' })}><Plus size={16}/>新增产区身份草案</button></div><p className="sys-hint">业务身份定义、用户的身份授权、管理员岗位权限是三套独立对象。保存目录不能给用户自动开通身份；实际网页和小程序需读取服务端已发布目录，而非修改本地role字符串。</p></section>
    <section className="panel"><div className="sys-toolbar"><FilterField label="筛选产区"><select value={industry} onChange={e => setIndustry(e.target.value)}><option>全部</option>{identityIndustries.map(i => <option key={i}>{i}</option>)}</select></FilterField><button className="secondary-button" onClick={() => { if (act({ type: 'identity.export', count: definitions.length })) downloadText('乡桥产区身份目录草案.json', JSON.stringify({ version: 1, centerId, mode: 'draft-only', definitions }, null, 2)) }}><Download size={16}/>导出目录草案</button></div><Table headers={['身份名称', '适用产区', '复用模板', '准入与规则', '状态', '操作']} empty={!rows.length}>{rows.map(d => <tr key={d.id}><td><strong>{d.name}</strong></td><td>{d.industry}</td><td>{identityTemplates.find(t => t.id === d.templateId)?.name}</td><td>{d.admission}</td><td>{d.status}</td><td>{d.status === '待发布草案' ? <button className="sys-link" disabled={!canManage} onClick={() => setEditing({ ...d })}>编辑身份草案</button> : <span>平台基础模板</span>}</td></tr>)}</Table></section>
    {editing ? <SystemDialog title="产区身份草案" onClose={() => setEditing(null)}><form className="sys-form" onSubmit={e => { e.preventDefault(); if (act({ type: 'identity.save', definition: editing })) setEditing(null) }}><label>业务身份名称<input required minLength={2} maxLength={40} value={editing.name} placeholder="如葡萄修剪队（测试）" onChange={e => setEditing({ ...editing, name: e.target.value })}/></label><label>适用产区<select value={editing.industry} onChange={e => setEditing({ ...editing, industry: e.target.value })}>{identityIndustries.map(i => <option key={i}>{i}</option>)}</select></label><label>基础业务模板<select value={editing.templateId} onChange={e => setEditing({ ...editing, templateId: e.target.value as BusinessIdentityDefinition['templateId'] })}>{identityTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><p className="sys-hint">复用模块：{identityTemplates.find(t => t.id === editing.templateId)?.modules.join('、')}。{identityTemplates.find(t => t.id === editing.templateId)?.rule}</p><label>产区准入与作业要求<textarea required minLength={8} maxLength={300} value={editing.admission} onChange={e => setEditing({ ...editing, admission: e.target.value })}/></label><button className="primary-inline">保存业务身份草案</button></form></SystemDialog> : null}
  </>
}

function SocialView({ state, act, canManage, platformManager, scope }: { state: SystemState; act: ActionRunner; canManage: boolean; platformManager: boolean; scope: ScopeId }) {
  const [center, setCenter] = useState('fuan')
  const organizations = state.organizations.filter(o => o.status !== '待平台审核')
  const canEdit = canManage && (platformManager || center !== 'platform' && ['fuan', 'saiqi', 'xibing'].includes(center) && (scope === 'fuan' || scope === center))
  const localPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
  const previewHref = localPreview ? `/home-preview?center=${encodeURIComponent(center)}#social` : 'https://nong.cloud/#social'
  return <>
    <section className="panel sys-panel"><div className="sys-section-head"><div><h2>官方社交账号与页脚入口</h2><p>平台总入口和各中心账号独立，不把一个县域的账号覆盖到全部中心。</p></div><FilterField label="配置所属组织"><select value={center} onChange={e => setCenter(e.target.value)}>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></FilterField></div><p className="sys-hint">{canEdit ? '可维护当前辖区的本地配置。' : '当前岗位只能查看该组织配置，不能修改平台或其他辖区账号。'} 未提供官方链接时显示“待配置”，不生成虚假二维码，不自动跳转。</p></section>
    <div className="sys-catalog">{socialPlatforms.map(platform => {
      const account = state.socials.find(a => a.centerId === center && a.id === platform.id)
      return account ? <SocialAccountForm key={`${center}:${platform.id}`} platformName={platform.name} account={account} act={act} canEdit={canEdit}/> : null
    })}</div>
    <section className="panel sys-panel"><h2>配置预览与正式发布</h2><p className="sys-hint">本机预览可联动已保存的同组织配置；nong.cloud线上总入口仍使用平台的审核发布版本。跨域同步、品牌账号归属验证及二维码资产管理待后端接入。</p><a className="secondary-button" href={previewHref} target="_blank" rel="noopener noreferrer">{localPreview ? '预览该中心页脚图标' : '查看线上官网（不会同步本机操作）'}<ExternalLink size={15}/></a></section>
  </>
}

function SocialAccountForm({ account, act, canEdit, platformName }: { account: SocialAccount; act: ActionRunner; canEdit: boolean; platformName: string }) {
  const [draft, setDraft] = useState({ ...account })
  return <article className="panel sys-integration sys-social-card"><div className="sys-card-head"><SocialIcon id={account.id}/><Tag tone={account.enabled ? 'amber' : 'gray'}>{account.enabled ? '本地链接启用' : '待配置 / 未启用'}</Tag></div><h2>{platformName}</h2><form className="sys-form" onSubmit={e => { e.preventDefault(); act({ type: 'social.save', account: draft }) }}><label>账号名称（{platformName}）<input disabled={!canEdit} value={draft.accountName} maxLength={50} placeholder="官方账号名称，未开通可留空" onChange={e => setDraft({ ...draft, accountName: e.target.value })}/></label><label>官方主页链接（{platformName}）<input disabled={!canEdit} value={draft.href} maxLength={300} placeholder="https:// 官方平台主页或分享短链接" onChange={e => setDraft({ ...draft, href: e.target.value })}/></label><label className="sys-inline-check"><input type="checkbox" disabled={!canEdit} checked={draft.enabled} onChange={e => setDraft({ ...draft, enabled: e.target.checked })}/>启用该中心的本地页脚链接</label><p className="sys-hint">只接受对应平台HTTPS链接。视频号若暂无公开主页链接，可先保存账号名并保持未启用。</p><button className="secondary-button" disabled={!canEdit}>保存{platformName}本地配置</button></form></article>
}

function CentersView({ organizations, actorId, act, canApply, canApprove }: { organizations: Organization[]; actorId: string; act: ActionRunner; canApply: boolean; canApprove: boolean }) {
  const [adding, setAdding] = useState(false), [name, setName] = useState(''), [company, setCompany] = useState(''), [region, setRegion] = useState('')
  const [kind, setKind] = useState<Organization['kind']>('独立公司运营中心')
  const centers = organizations.filter(o => o.parentId === 'platform')
  return <>
    <Stats items={[{ label: '区县中心目录', value: centers.length, detail: '规划、筹备与演示目录分开显示' }, { label: '待平台审核', value: organizations.filter(o => o.status === '待平台审核').length, detail: '未授予权限或复制生产数据' }, { label: '组织层级', value: '平台 → 区县 → 站点', detail: '运营主体与分公司法律形式分开' }]}/>
    <section className="panel sys-panel"><div className="sys-section-head"><div><h2>乡桥组织架构</h2><p>新设公司、合作运营和乡镇站点采用不同主体类型。</p></div><button className="primary-inline" disabled={!canApply} onClick={() => { setAdding(true); setName(''); setCompany(''); setRegion('') }}><Plus size={16}/>新增区县服务中心申请</button></div><div className="sys-org-tree"><div className="sys-org-root"><Building2 size={24}/><div><strong>乡桥农业有限公司</strong><small>平台产品、标准体系、跨区域授权与审核</small></div></div><div className="sys-org-branches">{centers.map(o => <article key={o.id}><h3>{o.name}</h3><p>{o.company}</p><small>{o.region}</small><div><Tag tone={o.status === '待平台审核' ? 'amber' : 'gray'}>{o.status}</Tag></div>{organizations.filter(s => s.parentId === o.id).map(s => <span className="sys-org-leaf" key={s.id}>↳ {s.name}</span>)}</article>)}</div></div></section>
    <section className="panel"><div className="panel-head"><div><h2>运营主体与接入状态</h2><p>以下目录不是企业登记、法定认证或真实中心启用证明</p></div></div><Table headers={['组织 / 运营主体', '类型', '辖区', '状态', '接入与审批']}>{organizations.map(o => <tr key={o.id}><td><strong>{o.name}</strong><small>{o.company}</small></td><td>{o.kind}</td><td>{o.region}</td><td>{o.status}</td><td>{o.status === '待平台审核' ? <button className="sys-link" disabled={!canApprove || o.applicantId === actorId} onClick={() => act({ type: 'center.approve', id: o.id })}>平台审核演示申请</button> : <span>账号 / 接口 / 商户绑定待真实接入</span>}</td></tr>)}</Table></section>
    <section className="panel sys-panel"><h2>各区县独立运营，平台授权协同</h2><div className="sys-center-capabilities"><article><h3>人员与数据</h3><p>中心管理员、种植户、地块、工单和合同按tenant_id归属，跨中心访问需单独授权，不能通过前端选择器越权。</p></article><article><h3>品牌与接入</h3><p>新闻、社交账号、接口绑定和设备清单分别配置；复制流程模板，不复制其他县域的农户与经营数据。</p></article><article><h3>商户与分账</h3><p>法定运营主体、中心特约商户和分账规则独立绑定。资金与退款权限继续在管理后台，不放入小程序工作台。</p><Link to="/merchants">查看商户与分账演示 →</Link></article></div></section>
    {adding ? <SystemDialog title="新增区县服务中心申请" onClose={() => setAdding(false)}><form className="sys-form" onSubmit={e => { e.preventDefault(); if (act({ type: 'center.request', name, company, kind, region })) setAdding(false) }}><label>农事服务中心名称<input required value={name} minLength={4} maxLength={80} placeholder="某区县农事综合服务中心（测试）" onChange={e => setName(e.target.value)}/></label><label>拟定运营主体名称<input required value={company} minLength={4} maxLength={100} onChange={e => setCompany(e.target.value)}/></label><label>运营主体类型<select value={kind} onChange={e => setKind(e.target.value as Organization['kind'])}><option>独立公司运营中心</option><option>分公司运营中心</option><option>合作运营中心</option></select></label><label>省市区县与拟落地地址（仅测试）<input required value={region} minLength={4} maxLength={100} onChange={e => setRegion(e.target.value)}/></label><p className="sys-hint">这里只提交本机筹备申请，不登记公司或开通商户。正式启用需审核法定主体、行政辖区、服务能力、品牌授权、管理员范围及特约商户绑定；申请人不可自批。</p><button className="primary-inline">提交中心筹备申请</button></form></SystemDialog> : null}
  </>
}

function NewsView({ articles, actorId, act, canEdit, canReview }: { articles: NewsArticle[]; actorId: string; act: ActionRunner; canEdit: boolean; canReview: boolean }) {
  const localPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
  const [query, setQuery] = useState(''), [status, setStatus] = useState('全部'), [editing, setEditing] = useState<NewsArticle | null>(null), [preview, setPreview] = useState<NewsArticle | null>(null)
  const filtered = articles.filter(a => (status === '全部' || a.status === status) && `${a.title} ${a.category}`.includes(query.trim()))
  function newDraft() { setEditing({ id: `news-${Date.now().toString(36)}`, title: '', summary: '', body: '', category: '中心动态', date: '2026-10-06', status: '草稿', authorId: actorId, author: '当前演示编辑', revision: 1 }) }
  return <>
    <Stats items={[{ label: '稿件总数', value: articles.length, detail: '示例内容和本机编辑草稿' }, { label: '待审核', value: articles.filter(a => a.status === '待审核').length, detail: '编辑不能审核自己的稿件' }, { label: '公开预览', value: articles.filter(a => a.status === '演示已发布').length, detail: '线上官网需后端发布或部署更新' }]}/>
    <section className="panel"><div className="panel-head"><div><h2>新闻与公告</h2><p>不将规划、补贴申请或待认证事项写成已完成事实</p></div><button className="primary-inline" disabled={!canEdit} onClick={newDraft}><Plus size={16}/>新增新闻</button></div><div className="sys-toolbar"><SearchBox label="搜索新闻标题或栏目" value={query} onChange={setQuery}/><FilterField label="新闻状态"><select value={status} onChange={e => setStatus(e.target.value)}>{['全部', '草稿', '待审核', '演示已发布', '已下架'].map(s => <option key={s}>{s}</option>)}</select></FilterField><a className="secondary-button" href={localPreview ? '/home-preview?center=fuan#news' : 'https://nong.cloud/#news'} target="_blank" rel="noopener noreferrer">{localPreview ? '查看本机官网预览' : '查看线上官网'}<ExternalLink size={15}/></a></div>
      <Table headers={['标题 / 栏目', '日期', '编辑', '状态', '操作']} empty={!filtered.length}>{filtered.map(a => <tr key={a.id}><td><strong>{a.title}</strong><small>{a.category}</small></td><td>{a.date}</td><td>{a.author}</td><td><Tag tone={a.status === '演示已发布' ? 'green' : a.status === '待审核' ? 'amber' : 'gray'}>{a.status}</Tag></td><td><div className="sys-table-actions"><button className="sys-link" onClick={() => setPreview(a)}>预览新闻</button>{['草稿', '已下架'].includes(a.status) && canEdit ? <button className="sys-link" onClick={() => setEditing({ ...a })}>编辑新闻</button> : null}{a.status === '草稿' && a.authorId === actorId && canEdit ? <button className="sys-link" onClick={() => act({ type: 'news.submit', id: a.id })}>提交审核</button> : null}{a.status === '待审核' && a.authorId === actorId && canEdit ? <button className="sys-link" onClick={() => act({ type: 'news.withdraw', id: a.id })}>撤回审核</button> : null}{a.status === '待审核' && canReview ? <button className="sys-link" disabled={a.authorId === actorId || a.contributors?.includes(actorId)} onClick={() => act({ type: 'news.approve', id: a.id })}>审核演示发布</button> : null}{a.status === '演示已发布' && canReview ? <button className="sys-link" onClick={() => act({ type: 'news.unpublish', id: a.id })}>下架演示</button> : null}</div></td></tr>)}</Table></section>
    <p className="sys-hint">“本机官网预览”仅在本地开发路径可联动；m.nong.cloud不会因为浏览器本地操作直接改变nong.cloud。正式发布需编辑/审核权限、版本、审计与服务器发布接口。</p>
    {preview ? <SystemDialog title={preview.title} onClose={() => setPreview(null)}><p className="news-meta">{preview.category} · {preview.date} · {preview.status} · 示例资讯</p><p className="news-summary">{preview.summary}</p>{preview.body.split('\n').map((p, index) => <p key={index}>{p}</p>)}</SystemDialog> : null}
    {editing ? <SystemDialog title={articles.some(a => a.id === editing.id) ? '编辑新闻草稿' : '新增新闻'} onClose={() => setEditing(null)}><form className="sys-form" onSubmit={e => { e.preventDefault(); if (act({ type: 'news.save', article: editing })) setEditing(null) }}><label>新闻标题<input value={editing.title} minLength={4} maxLength={80} required onChange={e => setEditing({ ...editing, title: e.target.value })}/></label><div className="sys-form-row"><label>新闻栏目<select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value as NewsArticle['category'] })}>{newsCategories.map(c => <option key={c}>{c}</option>)}</select></label><label>展示日期（示例）<input type="date" required value={editing.date} onChange={e => setEditing({ ...editing, date: e.target.value })}/></label></div><label>新闻摘要<textarea value={editing.summary} minLength={8} maxLength={240} required onChange={e => setEditing({ ...editing, summary: e.target.value })}/></label><label>新闻正文（纯文本）<textarea className="sys-body-input" value={editing.body} minLength={20} maxLength={6000} required onChange={e => setEditing({ ...editing, body: e.target.value })}/></label><p className="sys-hint">请使用测试内容，不填真实个人资料。纯文本展示，不执行HTML脚本。保存草稿不会发布。</p><button className="primary-inline"><Save size={16}/>保存新闻草稿</button></form></SystemDialog> : null}
  </>
}
