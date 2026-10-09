import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Braces, Check, Code2, Copy, Download, KeyRound, Layers, Plus, Radio, ShieldCheck, Terminal } from 'lucide-react'
import { Modal, Panel, SearchField, Stats, Table, Tag } from '../farm/ui'
import { allowedScopes, endpoints, kinds, openApiDraft, requestCurl, sandboxBase, scopeLabel, webhookEvents } from './catalog'
import type { AppKind, Endpoint } from './catalog'
import type { AppCommand, DebugInput, DebugResult, PartnerApp } from './model'
import { useApiConsole } from './useApiConsole'
import { apiSiteDomain, apiSiteEntry, plannedApiBase } from './site'
import './openapi.css'

const tabs = [{ id: 'overview', label: '概览', icon: Layers }, { id: 'catalog', label: '接口目录', icon: Braces }, { id: 'apps', label: '接入应用', icon: KeyRound }, { id: 'debug', label: '沙箱调试', icon: Terminal }, { id: 'logs', label: '调用日志', icon: Radio }, { id: 'guide', label: '接入指南', icon: BookOpen }]
const categories = [...new Set(endpoints.map(e => e.category))]
const uid = () => `DEMO-${crypto.randomUUID()}`
const defaultObject = (id: string) => id === 'card-sync' ? 'DEMO-CARD-001' : 'DEMO-ORDER-001'
const time = (at: number) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(at)
type Dialog = { type: 'create' } | { type: 'approve' | 'rotate' | 'disable'; app: PartnerApp } | { type: 'key'; name: string; value: string } | { type: 'copy'; value: string }
const errorText = (error: unknown) => error instanceof Error ? error.message : '操作未完成，请重试'

function CodeBlock({ children }: { children: string }) { return <pre className="api-code" tabIndex={0}><code>{children}</code></pre> }

function CreateApp({ onSave, onClose }: { onSave: (command: AppCommand) => void; onClose: () => void }) {
  const [name, setName] = useState(''); const [organization, setOrganization] = useState('')
  const [kind, setKind] = useState<AppKind>('采购合作'); const [scopes, setScopes] = useState<string[]>(['maturity.read'])
  const [quota, setQuota] = useState(60); const [callback, setCallback] = useState(''); const [events, setEvents] = useState<string[]>([])
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try { onSave({ type: 'create', app: { id: uid(), name, organization, kind, scopes, quota, callback: callback.trim(), events } }) }
    catch (cause) { setError(errorText(cause)) }
  }
  return <form className="farm-form api-form" onSubmit={submit}>
    <p className="api-note">创建的是本机演示应用。请使用虚构主体；生产环境需主体审核与真实对象授权。</p>
    <div className="farm-form-grid"><label>应用名称<input required maxLength={50} value={name} onChange={e => setName(e.target.value)} placeholder="例如：产业带采购助手"/></label><label>经营主体<input required maxLength={80} value={organization} onChange={e => setOrganization(e.target.value)} placeholder="填写演示企业或机构"/></label></div>
    <div className="farm-form-grid"><label>应用用途<select value={kind} onChange={e => { const value = e.target.value as AppKind; setKind(value); setScopes([allowedScopes[value][0]]); setEvents([]) }}>{kinds.map(k => <option key={k}>{k}</option>)}</select></label><label>本地演示配额（次/分钟）<input type="number" required min={1} max={120} value={quota} onChange={e => setQuota(Number(e.target.value))}/></label></div>
    <fieldset className="api-fieldset"><legend>申请接口权限</legend>{allowedScopes[kind].map(scope => <label className="farm-check" key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={e => setScopes(e.target.checked ? [...scopes, scope] : scopes.filter(s => s !== scope))}/><span>{scopeLabel(scope)}<small>{scope}</small></span></label>)}</fieldset>
    <label>事件回调地址（可选）<input type="url" maxLength={500} value={callback} onChange={e => setCallback(e.target.value)} placeholder="https://example.com/webhooks"/><small>只保存配置，不访问回调地址、不发送事件；正式环境需服务端验证地址。</small></label>
    <fieldset className="api-fieldset"><legend>事件订阅草案（可选）</legend>{webhookEvents[kind].map(value => <label className="farm-check" key={value}><input type="checkbox" checked={events.includes(value)} onChange={e => setEvents(e.target.checked ? [...events, value] : events.filter(s => s !== value))}/>{value}</label>)}</fieldset>
    {error && <p className="farm-warning" role="alert">{error}</p>}
    <div className="farm-modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-inline">提交演示申请</button></div>
  </form>
}

function AppAction({ action, app, onSave, onClose }: { action: 'approve' | 'rotate' | 'disable'; app: PartnerApp; onSave: (command: AppCommand) => void; onClose: () => void }) {
  const [consent, setConsent] = useState(false); const [confirmation, setConfirmation] = useState(''); const [error, setError] = useState('')
  return <form className="farm-form" onSubmit={e => { e.preventDefault(); try { onSave(action === 'approve' ? { type: action, id: app.id, consent } : { type: action, id: app.id, confirmation }) } catch (cause) { setError(errorText(cause)) } }}>
    <div className="api-app-summary"><strong>{app.name}</strong><span>{app.organization} · {app.kind}</span><code>{app.id}</code><p>申请范围：{app.scopes.map(scopeLabel).join('、')}</p><p>演示配额：{app.quota}次/分钟</p><p>事件回调：{app.callback || '未配置'}<br/>订阅：{app.events.join('、') || '未订阅'}</p></div>
    {action === 'approve' ? <label className="farm-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>我已确认演示用途与接口范围；真实对象授权仍需在正式服务端核验。</label> : <><p className="farm-warning">{action === 'rotate' ? '轮换后旧演示版本不再通过本地校验。这里只生成无效的DEMO展示串，不操作真实凭据。' : '停用后本机调试将返回401；不影响真实应用、农户或外部系统。'}</p><label>输入应用全名确认<input required value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder={app.name}/></label></>}
    {error && <p role="alert" className="farm-warning">{error}</p>}
    <div className="farm-modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-inline" disabled={action === 'approve' ? !consent : confirmation !== app.name}>{action === 'approve' ? '确认模拟开通' : action === 'rotate' ? '确认轮换' : '确认停用'}</button></div>
  </form>
}

function EndpointDetail({ endpoint, onDebug, onCopy }: { endpoint: Endpoint; onDebug: () => void; onCopy: (text: string) => void }) {
  const curl = requestCurl(endpoint, endpoint.example, defaultObject(endpoint.id))
  return <Panel title={endpoint.name} caption="接口设计草案 · 尚未部署" action={<Tag tone="gray">{endpoint.access}</Tag>}>
    <div className="api-panel-body api-detail">
      <div className="api-route"><Tag tone={endpoint.method === 'GET' ? 'green' : 'amber'}>{endpoint.method}</Tag><code>/open-api/v1{endpoint.path}</code></div>
      <p>{endpoint.description}</p><div className="api-scope"><ShieldCheck size={15}/>所需权限 <code>{endpoint.scope}</code></div>
      <h3>请求参数 <small>{endpoint.method === 'GET' ? 'Query' : 'JSON Body'}</small></h3>
      {endpoint.pathParameter && <p className="api-note">路径参数：<code>{endpoint.pathParameter}</code>（必填）；按对象授权，不可任意枚举。</p>}
      <div className="api-params-wrap"><table className="api-params"><thead><tr><th>参数</th><th>类型</th><th>说明</th></tr></thead><tbody>{endpoint.fields.map(f => <tr key={f.name}><td><code>{f.name}</code>{f.required && <span className="api-required">必填</span>}</td><td>{f.type}</td><td>{f.description}</td></tr>)}</tbody></table></div>
      <h3>请求示例</h3><CodeBlock>{JSON.stringify(endpoint.example, null, 2)}</CodeBlock>
      <div className="api-section-heading"><h3>cURL接入草案</h3><button className="farm-link" onClick={() => onCopy(curl)}><Copy size={14}/>复制草案</button></div><CodeBlock>{curl}</CodeBlock>
      <p className="api-note">Authorization使用正式应用访问令牌；写入还需Idempotency-Key。示例地址不可调用，示例令牌无效。</p>
      <button className="primary-inline" onClick={onDebug}><Terminal size={16}/>送到本地沙箱<ArrowRight size={15}/></button>
    </div>
  </Panel>
}

function DebugRunner({ endpoint, apps, appId, setAppId, keyVersion, setKeyVersion, run, onCopy }: { endpoint: Endpoint; apps: PartnerApp[]; appId: string; setAppId: (id: string) => void; keyVersion: number; setKeyVersion: (v: number) => void; run: (input: DebugInput) => DebugResult; onCopy: (text: string) => void }) {
  const [parameters, setParameters] = useState(JSON.stringify(endpoint.example, null, 2))
  const [objectId, setObjectId] = useState(defaultObject(endpoint.id)); const [idempotencyKey, setIdempotencyKey] = useState('DEMO-REQUEST-001')
  const [result, setResult] = useState<Pick<DebugResult, 'envelope' | 'status' | 'replay'> | null>(null); const [error, setError] = useState('')
  const selectedApp = apps.find(a => a.id === appId)
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError('')
    try { const value = run({ appId, endpointId: endpoint.id, keyVersion, parameters, objectId, idempotencyKey, at: Date.now(), traceId: uid() }); setResult({ envelope: value.envelope, status: value.status, replay: value.replay }) }
    catch (cause) { setError(errorText(cause)); setResult(null) }
  }
  return <div className="api-debug-grid">
    <Panel title="请求配置" caption="纯本地执行，不发出HTTP请求">
      <form className="farm-form api-panel-body" onSubmit={submit}>
        <div className="api-route"><Tag tone={endpoint.method === 'GET' ? 'green' : 'amber'}>{endpoint.method}</Tag><code>{endpoint.path}</code></div>
        <label>调试应用<select value={appId} onChange={e => { setAppId(e.target.value); setKeyVersion(apps.find(a => a.id === e.target.value)?.keyVersion || 0); setResult(null) }}>{apps.map(a => <option key={a.id} value={a.id}>{a.name} · {a.status}</option>)}</select></label>
        <div className="api-version-row"><label>演示凭据版本<input type="number" min={0} required value={keyVersion} onChange={e => setKeyVersion(Number(e.target.value))}/></label><button type="button" className="secondary-button" onClick={() => { setKeyVersion(selectedApp?.keyVersion || 0); setResult(null) }}>使用当前版本</button></div>
        <p className="api-note">版本值仅供本地模拟鉴权，非正式请求参数；当前应用配额{selectedApp?.quota || 0}次/分钟。</p>
        {endpoint.pathParameter && <label>{endpoint.pathParameter}（路径参数）<input required value={objectId} onChange={e => setObjectId(e.target.value)}/></label>}
        {endpoint.method === 'POST' && <label>Idempotency-Key<input value={idempotencyKey} onChange={e => setIdempotencyKey(e.target.value)}/><button type="button" className="farm-link" onClick={() => setIdempotencyKey(uid())}>生成新演示请求编号</button></label>}
        <label>JSON参数<textarea className="api-json-input" rows={10} spellCheck={false} value={parameters} onChange={e => setParameters(e.target.value)}/></label>
        <p className="api-note">对象白名单只演示DEMO-PLOT-001、DEMO-CARD-001、DEMO-ORDER-001和DEMO-SAMPLE-001。真实关系、签名和媒体归属待服务端实现。</p>
        {error && <p className="farm-warning" role="alert">{error}</p>}
        <div className="api-actions"><button className="primary-inline"><Terminal size={16}/>运行本地调试</button><button className="secondary-button" type="button" onClick={() => { try { const parsed: unknown = JSON.parse(parameters); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('请先填写有效JSON对象'); onCopy(requestCurl(endpoint, parsed as Record<string, unknown>, objectId, idempotencyKey)) } catch (cause) { setError(errorText(cause)) } }}><Copy size={15}/>复制请求草案</button></div>
      </form>
    </Panel>
    <Panel title="模拟响应" caption="统一响应体 · code / message / data / traceId / timestamp" action={result && <Tag tone={result.status === 200 ? 'green' : 'red'}>本地模拟 HTTP {result.status}</Tag>}>
      <div className="api-panel-body api-response" aria-live="polite">
        {result ? <>{result.replay && <p className="api-note">命中本地幂等结果，未再次提交。</p>}<CodeBlock>{JSON.stringify(result.envelope, null, 2)}</CodeBlock><p className="api-note">traceId可在当前会话的调用日志中查找。关闭或刷新页面会清空响应、日志和幂等缓存。</p></> : <div className="api-empty"><Code2 size={30}/><strong>等待一条本地请求</strong><span>选择应用，检查参数，运行调试。<br/>不会更改真实农事记录或交易。</span></div>}
        <div className="api-status-guide">200 成功 · 400 参数 · 401 凭据<br/>403 授权 · 409 幂等冲突 · 429 配额</div>
      </div>
    </Panel>
  </div>
}

export default function OpenApiPage({ standalone = false }: { standalone?: boolean }) {
  const { state, warning, notice, command, run, setNotice } = useApiConsole()
  const [params, setParams] = useSearchParams(); const tab = tabs.some(t => t.id === params.get('tab')) ? params.get('tab')! : 'overview'
  const go = (value: string) => setParams({ tab: value })
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('全部'); const [selectedId, setSelectedId] = useState(endpoints[0].id)
  const initialDebugApp = state.apps.find(a => a.status === '沙箱启用' && a.scopes.includes(endpoints[0].scope)) || state.apps[0]
  const [debugId, setDebugId] = useState(endpoints[0].id); const [debugApp, setDebugApp] = useState(initialDebugApp.id); const [debugVersion, setDebugVersion] = useState(initialDebugApp.keyVersion)
  const [dialog, setDialog] = useState<Dialog | null>(null); const [logApp, setLogApp] = useState('全部'); const [logStatus, setLogStatus] = useState('全部')
  const visible = endpoints.filter(e => (category === '全部' || e.category === category) && `${e.name} ${e.path} ${e.scope}`.toLowerCase().includes(query.trim().toLowerCase()))
  const selected = visible.find(e => e.id === selectedId) || visible[0]
  const debugEndpoint = endpoints.find(e => e.id === debugId) || endpoints[0]
  const logs = state.calls.filter(c => (logApp === '全部' || c.appId === logApp) && (logStatus === '全部' || String(c.status) === logStatus))
  const close = () => setDialog(null)
  const save = (action: AppCommand) => {
    const next = command(action)
    if (action.type === 'approve' || action.type === 'rotate') { const app = next.apps.find(a => a.id === action.id)!; setDialog({ type: 'key', name: app.name, value: `DEMO_NOT_VALID_${app.id}_v${app.keyVersion}_${crypto.randomUUID()}` }) }
    else close()
  }
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); setNotice('接入草案已复制；示例地址与凭据不可真实调用。') } catch { setDialog({ type: 'copy', value }) } }
  const download = () => {
    try { const url = URL.createObjectURL(new Blob([JSON.stringify(openApiDraft(), null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'xiangqiao-openapi-0.1.0-draft.json'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('已生成OpenAPI接口设计草案；不是已部署服务。') }
    catch { setDialog({ type: 'copy', value: JSON.stringify(openApiDraft(), null, 2) }) }
  }
  return <div className="farm-page api-page">
    <div className="page-heading"><div><div className="farm-eyebrow">{standalone ? `${apiSiteDomain} · 开发者站点` : '乡桥农事 · 开放协同'}</div><h1>API开放平台</h1><p>连接设备、服务机构与采购应用，让授权数据成为产业协同的桥梁。</p></div><div className="api-actions">{!standalone && <a className="secondary-button" href={apiSiteEntry(window.location.hostname)}>独立API站点</a>}<button className="primary-inline" onClick={() => setDialog({ type: 'create' })}><Plus size={17}/>创建接入应用</button></div></div>
    <div className="farm-demo"><ShieldCheck size={17}/><span>前端沙箱 · 接口尚未部署，调试不发送网络请求。示例数据基准日2026-08-29；不向农户收平台服务费，不开放成本、家庭信息或原始定位。</span></div>
    {warning && <p role="alert" className="farm-warning">{warning}</p>}{notice && <div className="farm-feedback" role="status"><Check size={15}/>{notice}</div>}
    <nav className="api-tabs" aria-label="开放平台栏目">{tabs.map(({ id, label, icon: Icon }) => <button key={id} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'active' : ''} onClick={() => go(id)}><Icon size={16}/>{label}</button>)}</nav>
    <Stats items={[{ label: '规划接口', value: endpoints.length, detail: '5类业务 · 全部为接入草案' }, { label: '演示接入应用', value: state.apps.length, detail: `${state.apps.filter(a => a.status === '沙箱启用').length}个沙箱启用 · 仅本机元数据` }, { label: '本会话本地调用', value: state.counters.total, detail: '刷新即清空 · 非网关统计' }, { label: '本地调试成功率', value: state.counters.total ? `${Math.round(state.counters.success / state.counters.total * 100)}%` : '—', detail: `${state.counters.success}成功 / ${state.counters.failures}未通过` }]} />
    {tab === 'overview' && <>
      <section className="api-hero"><div><span className="api-kicker">API.NONG.CLOUD / OPEN PLATFORM</span><h2>让一张农事卡，<br/>连接更多服务。</h2><p>采购看货源，机构交报告，设备传记录。<br/>统一接口，按用途授权，保留完整业务边界。</p><div className="api-actions"><button className="api-hero-button" onClick={() => go('catalog')}>浏览接口目录<ArrowRight size={16}/></button><button className="api-hero-link" onClick={() => go('guide')}>阅读接入指南</button></div></div><div className="api-bridge" aria-label="开放协同层级"><div><Code2 size={21}/><strong>乡桥开放接口</strong><Tag>设计草案</Tag></div><div><span>设备厂商</span><span>服务团队</span><span>检测机构</span><span>采购应用</span></div><p><ShieldCheck size={15}/>应用权限 × 对象授权 × 字段最小化</p></div></section>
      <div className="api-overview-grid"><Panel title="业务接口" caption="围绕生产记录与产销协同开放"><div className="api-categories">{categories.map((value, i) => <button key={value} onClick={() => { setCategory(value); setQuery(''); go('catalog') }}><span className="api-category-number">0{i + 1}</span><span><strong>{value}</strong><small>{endpoints.filter(e => e.category === value).length}个规划接口</small></span><ArrowRight size={17}/></button>)}</div></Panel><Panel title="从接入到协同" caption="前三步可本地演示，第四步待正式开发"><ol className="api-steps">{['创建应用 · 明确主体与用途', '模拟审核 · 最小接口范围', '本地调试 · 验证参数与幂等', '生产接入 · 服务端鉴权与审计'].map((s, i) => <li key={s}><b>{i + 1}</b><span>{s}</span></li>)}</ol><div className="api-panel-body api-boundary"><strong>公开不等于全部开放</strong><p>成熟货源和库存由货主主动公开；农事记录、检测报告和报送资料须核验对象授权。乡桥记录核验不代替法定认证。</p></div></Panel></div>
    </>}
    {tab === 'catalog' && <>
      <div className="panel api-toolbar"><SearchField value={query} onChange={setQuery} placeholder="搜索接口名称、路径或权限"/><label>业务分类<select aria-label="业务分类" value={category} onChange={e => setCategory(e.target.value)}>{['全部', ...categories].map(c => <option key={c}>{c}</option>)}</select></label><button className="secondary-button" onClick={download}><Download size={15}/>导出OpenAPI草案</button></div>
      {selected ? <div className="api-catalog-layout"><section className="panel api-catalog-list" aria-label="接口列表">{visible.map(e => <button key={e.id} className={selected.id === e.id ? 'selected' : ''} aria-pressed={selected.id === e.id} onClick={() => setSelectedId(e.id)}><div><Tag tone={e.method === 'GET' ? 'green' : 'amber'}>{e.method}</Tag><small>{e.category}</small></div><strong>{e.name}</strong><code>{e.path}</code><span>{e.access}<ArrowRight size={14}/></span></button>)}</section><EndpointDetail endpoint={selected} onDebug={() => { setDebugId(selected.id); go('debug') }} onCopy={copy}/></div> : <div className="panel api-empty"><Braces size={28}/><strong>没有匹配的接口</strong><p>调整名称或业务分类后重试。</p><button className="secondary-button" onClick={() => { setQuery(''); setCategory('全部') }}>清空筛选</button></div>}
    </>}
    {tab === 'apps' && <>
      <Panel title="合作应用" caption="仅保存本机演示元数据；展示串不是真实App Secret，不持久保存">
        <Table headers={['应用与主体', '用途 / 接口范围', '状态', '演示凭据 / 配额', '操作']}>{state.apps.map(a => <tr key={a.id}><td><strong>{a.name}</strong><span>{a.organization}</span><code className="api-id">{a.id}</code></td><td><strong>{a.kind}</strong><div className="api-scope-tags">{a.scopes.map(s => <Tag key={s} tone="gray">{scopeLabel(s)}</Tag>)}</div><span>{a.events.length ? `${a.events.length}项回调订阅草案` : '未订阅事件'}</span></td><td><Tag tone={a.status === '沙箱启用' ? 'green' : a.status === '待审核' ? 'amber' : 'gray'}>{a.status}</Tag></td><td><code>DEMO · v{a.keyVersion} · ••••••</code><span>{a.quota}次/分钟（本地）</span></td><td><div className="api-row-actions">{a.status === '待审核' ? <button className="farm-link" onClick={() => setDialog({ type: 'approve', app: a })}>模拟审核</button> : a.status === '沙箱启用' ? <><button className="farm-link" onClick={() => setDialog({ type: 'rotate', app: a })}>轮换演示密钥</button><button className="farm-link api-danger" onClick={() => setDialog({ type: 'disable', app: a })}>停用沙箱</button></> : <span>演示凭据已失效</span>}</div></td></tr>)}</Table>
      </Panel><Panel title="本地应用操作留痕" caption="不是真实不可篡改审计；最近30条，刷新即清空"><div className="api-panel-body api-audit">{state.audit.length ? state.audit.map((entry, i) => <p key={`${i}-${entry}`}><Check size={14}/>{entry}</p>) : <p className="api-note">暂无操作。创建、模拟审核、轮换或停用后会显示记录。</p>}</div></Panel>
    </>}
    {tab === 'debug' && <>
      <div className="panel api-toolbar"><label>选择调试接口<select aria-label="选择调试接口" value={debugId} onChange={e => setDebugId(e.target.value)}>{endpoints.map(e => <option value={e.id} key={e.id}>{e.method} · {e.name}</option>)}</select></label><span className="api-note">真实HTTP地址尚未部署。请求只在浏览器内模拟。</span></div>
      <DebugRunner key={debugEndpoint.id} endpoint={debugEndpoint} apps={state.apps} appId={debugApp} setAppId={setDebugApp} keyVersion={debugVersion} setKeyVersion={setDebugVersion} run={run} onCopy={copy}/>
    </>}
    {tab === 'logs' && <Panel title="本会话调用日志" caption="只保留最近50条本地调试；不记录正文、凭据、成本或原始定位，不持久保存"><div className="api-toolbar"><label>应用筛选<select aria-label="日志应用筛选" value={logApp} onChange={e => setLogApp(e.target.value)}><option>全部</option>{state.apps.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}</select></label><label>状态筛选<select aria-label="日志状态筛选" value={logStatus} onChange={e => setLogStatus(e.target.value)}>{['全部', '200', '400', '401', '403', '409', '429'].map(s => <option key={s}>{s}</option>)}</select></label><span className="api-note">北京时间 · 当前会话{state.counters.total}次</span></div>{!state.calls.length ? <div className="api-empty"><Radio size={28}/><strong>暂无本地调试记录</strong><button className="secondary-button" onClick={() => go('debug')}>开始沙箱调试</button></div> : <Table headers={['时间 / traceId', '应用', '接口', '模拟状态', '幂等重放']} empty={!logs.length}>{logs.map(c => <tr key={c.id}><td><strong>{time(c.at)}</strong><code className="api-id">{c.id}</code></td><td>{state.apps.find(a => a.id === c.appId)?.name || '未知演示应用'}</td><td><Tag tone="gray">{c.method}</Tag><code className="api-log-path">{c.endpoint}</code></td><td><Tag tone={c.status === 200 ? 'green' : 'red'}>{c.status}</Tag></td><td>{c.replay ? '命中本地缓存' : '否'}</td></tr>)}</Table>}</Panel>}
    {tab === 'guide' && <>
      <Panel title="接入边界与协议草案" caption="共享一套业务内核，第三方接口由独立网关统一管控" action={<button className="secondary-button" onClick={download}><Download size={15}/>导出OpenAPI草案</button>}><div className="api-panel-body api-guide">
        <div className="api-guide-grid"><article><KeyRound size={21}/><h3>应用身份，不借用后台登录</h3><p>内部契约使用/api/v1；规划开放接口使用/open-api/v1。正式环境由服务端签发应用访问令牌并检查scope、有效期与对象关系，禁止把生产Secret放在网页或小程序里。</p></article><article><ShieldCheck size={21}/><h3>授权到对象与字段</h3><p>租户、县域与主体从可信凭据解析，不由请求体指定。采购合作只读主动公开摘要；记录、样品和工单需校验真实委托。拒绝越权，不返回农户成本、家庭信息与原始GPS轨迹。</p></article><article><Code2 size={21}/><h3>离线采集，幂等写入</h3><p>写入使用Idempotency-Key；卡片还需clientSeq、采集时间与按键配置版本。正式端须持久去重、校验设备签名和配置映射。相同键不同内容返回409；本页缓存仅在会话内有效。</p></article><article><Radio size={21}/><h3>回调与业务验收分开</h3><p>回调目前只登记草案。正式环境需校验HTTPS地址、防止内网访问、签名验签与重放防护，并实现投递重试。服务凭据提交不等于验收，追溯预检不等于外部报送成功。</p></article></div>
        <h3>地址与响应格式</h3><p className="api-note">目标开发者站点：{apiSiteDomain}。未来API Base为下方地址，接口尚未部署；当前cURL仍使用不可解析的演示占位地址。</p><CodeBlock>{plannedApiBase}</CodeBlock><p className="api-note">不可调用的cURL演示占位地址：</p><CodeBlock>{sandboxBase}</CodeBlock><CodeBlock>{JSON.stringify({ code: 0, message: 'OK（本地模拟）', data: { items: [], total: 0, page: 1, size: 20, hasNext: false }, traceId: 'DEMO-TRACE-001', timestamp: '2026-08-29T01:20:00Z' }, null, 2)}</CodeBlock>
        <p>文档格式：<a href="https://spec.openapis.org/oas/v3.0.3.html" target="_blank" rel="noreferrer">OpenAPI 3.0.3规范</a>；接口、响应和权限字段均为规划草案。</p>
      </div></Panel><div className="panel api-next"><div><strong>正式上线前还需要什么？</strong><p>应用资质审核、授权撤回、真实网关、限流与持久幂等、服务端审计、设备校验、外部平台适配和安全测试。收费策略与会员权益另行确定，不向生产端农户收费。</p></div>{!standalone && <Link className="secondary-button" to="/workspaces">查看角色工作台<ArrowRight size={15}/></Link>}</div>
    </>}
    {dialog && <Modal title={dialog.type === 'create' ? '创建接入应用' : dialog.type === 'approve' ? '模拟审核应用' : dialog.type === 'rotate' ? '轮换演示密钥' : dialog.type === 'disable' ? '停用沙箱应用' : dialog.type === 'key' ? '演示展示串 · 仅本次显示' : '手动复制接入草案'} onClose={close}>
      {dialog.type === 'create' ? <CreateApp onSave={save} onClose={close}/> : dialog.type === 'key' ? <div className="farm-form"><p className="farm-warning">{dialog.name}：这不是生产App Secret，也不是可用于访问服务的令牌。关闭窗口后不会再次显示；展示串只存在当前内存中，不写入本机存储。</p><label>DEMO展示串<textarea readOnly rows={4} value={dialog.value} onFocus={e => e.target.select()}/></label><button className="primary-inline" onClick={close}>知道了，关闭</button></div> : dialog.type === 'copy' ? <div className="farm-form"><p className="api-note">浏览器未允许自动复制；点击文本全选后手动复制。</p><textarea aria-label="接入草案文本" readOnly rows={14} value={dialog.value} onFocus={e => e.target.select()}/><button className="primary-inline" onClick={close}>关闭草案</button></div> : <AppAction action={dialog.type} app={dialog.app} onSave={save} onClose={close}/>}
    </Modal>}
  </div>
}
