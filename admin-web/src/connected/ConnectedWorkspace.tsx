import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { BrandLockup } from '../brand/BrandLockup'
import { ContentDialog } from '../components/ContentDialog'
import '../content/content.css'
import { BackendError, request, writeKey, pageRows, listPath, type Me, type Page, type Row } from './client'
import './connected.css'
import { LocalCorsProbe } from './LocalCorsProbe'
import { CardHistoryDialog } from './CardHistoryDialog'
import { useLocation, useNavigate } from 'react-router-dom'
import { connectedPath, resolveConnectedPath } from './routes'
import { WorkGuidance } from './WorkGuidance'

type Module = { id: string; title: string; path: string; permission: string; fields?: string[]; write?: string; createPath?: string }
const modules: Module[] = [
  { id: 'plots', title: '地块档案', path: '/plots?size=100', permission: 'plots.read', fields: ['name', 'areaMu', 'crop', 'address'] },
  { id: 'records', title: '农事记录', path: '/farm-activities', permission: 'records.read', fields: ['plotId', 'operation', 'note'] },
  { id: 'requests', title: '服务需求', path: '/service-requests', permission: 'services', fields: ['plotId', 'standardId', 'scheduledDate'] },
  { id: 'orders', title: '服务工单', path: '/work-orders', permission: 'services' },
  { id: 'cards', title: '农事卡', path: '/cards', permission: 'cards.read' },
  { id: 'cardRequests', title: '办卡与补卡', path: '/card-requests', permission: 'cardRequests', fields: ['kind', 'oldCardId', 'reason'] },
  { id: 'tickets', title: '帮助中心', path: '/help-tickets', permission: 'help.create', fields: ['category', 'description'] },
  { id: 'messages', title: '消息', path: '/messages', permission: 'messages.read' },
  { id: 'applications', title: '身份申请', path: '/identity-applications', permission: 'application.create', fields: ['role', 'subjectName', 'address', 'reason'] },
  { id: 'news', title: '新闻管理', path: '/admin/news', permission: 'news.manage', fields: ['title', 'body'] },
  { id: 'social', title: '社交渠道', path: '/admin/social-accounts', permission: 'news.manage', fields: ['channel', 'displayName', 'url', 'enabled'] },
  { id: 'audit', title: '操作日志', path: '/admin/audit-logs', permission: 'audit.read' },
  { id:'memberships',title:'会员申请',path:'/memberships',permission:'membership',write:'membership.apply',fields:['planId','reason'] },
  { id:'plans',title:'会员方案',path:'/membership-plans',permission:'membership.manage',write:'membership.manage',createPath:'/admin/membership-plans',fields:['name','role','feeFen','validDays'] },
  { id:'stock',title:'产品库存批次',path:'/stock-batches',permission:'trade',write:'stock.write',fields:['plotId','grade','quantityKg','unitPriceFenKg'] },
  { id:'trades',title:'采购与交接',path:'/trade-orders',permission:'trade',write:'trade.buy',fields:['batchId','quantityKg'] },
  { id:'centers',title:'分公司与中心',path:'/admin/centers',permission:'branches.manage',write:'branches.manage',fields:['name','countyCode'] },
  { id:'merchants',title:'商户配置',path:'/admin/merchants',permission:'finance.manage',write:'finance.manage',fields:['displayName','subMchid'] },
  { id:'settlements',title:'分账计算计划',path:'/admin/settlement-plans',permission:'finance.manage',write:'finance.manage',fields:['orderId','platformMerchantId','centerMerchantId','merchantServiceFeeFen','platformRateBps'] },
  { id:'standards',title:'服务执行标准',path:'/service-standards',permission:'center.manage',write:'center.manage',createPath:'/admin/service-standards',fields:['operation','criteria'] },
]
const labels: Record<string, string> = { kind:'申请类型',oldCardId:'原卡（已挂失）',newCardId:'新云端卡号',reviewNote:'审核说明',name: '地块名称', areaMu: '面积（亩）', crop: '种植产品', address: '所在地址', plotId: '地块', operation: '作业内容', note: '记录说明', standardId: '执行标准（已发布版本）', standardText: '执行标准', completionNote: '完工说明', reply: '中心回复', scheduledDate: '计划日期', category: '问题类别', description: '问题描述', role: '申请身份', subjectName: '主体名称', reason: '申请说明', title: '标题', body: '正文', channel: '社交平台', displayName: '账号名称', url: 'HTTPS主页链接', enabled: '是否启用', subjectId: '所属主体' }
const statusLabels: Record<string, string> = { pending: '待审核', verified: '已核验', rejected: '已驳回', open: '待处理', claimed: '已接单', working: '作业中', submitted: '待验收', accepted: '已验收', disputed: '有争议', processing: '处理中', resolved: '已回复', approved: '已批准', draft: '草稿', published: '已发布', withdrawn: '已撤回', active: '有效', lost: '挂失' }
Object.assign(statusLabels,{retired:'已停用',cloud_registered:'已云端登记',cancelled:'已取消'})
Object.assign(labels,{planId:'会员方案',feeFen:'会员费（分；农户必须为0）',validDays:'有效天数',grade:'等级（卖方自报）',quantityKg:'数量（千克）',unitPriceFenKg:'单价（分/千克）',batchId:'库存批次',countyCode:'区县代码（6位）',subMchid:'商户号（10位；未核验）',orderId:'已验收采购单',platformMerchantId:'总部接收对象',centerMerchantId:'当前中心接收对象',merchantServiceFeeFen:'商户侧服务收入计划（分；不从农户扣费）',platformRateBps:'总部分账比例（基点；100=1%）',amountFen:'金额',platformAmountFen:'总部份额',centerAmountFen:'中心份额',availableKg:'可用库存（千克）',expiresAt:'会员到期时间',platformRate:'分账比例',criteria:'执行与验收要求（发布后不可覆盖）',cancellationNote:'撤回/取消原因',cancelledAt:'撤回/取消时间（UTC）'})
Object.assign(statusLabels,{awaiting_payment:'待付款，未生效',reserved:'已锁定库存',seller_confirmed:'卖方已确认',dispatched:'已发货待验收',suspended:'已停用',blocked_external:'仅计算计划，支付未接通'})
const numericFields=new Set(['feeFen','validDays','quantityKg','unitPriceFenKg','merchantServiceFeeFen','platformRateBps','areaMu'])
function permits(me: Me, permission: string) { return permission==='membership'?me.permissions.some(p=>p==='membership.read'||p==='membership.manage'):permission==='trade'?me.permissions.some(p=>p==='trade.read'||p==='trade.manage'):permission === 'cardRequests' ? me.permissions.some(p=>p==='cards.request'||p==='cards.manage') : permission === 'services' ? me.permissions.some(p => p.startsWith('services.')) : me.permissions.includes(permission) }
const pagedModules = new Set(['plots', 'records', 'requests', 'orders', 'cards', 'cardRequests', 'tickets', 'messages', 'applications', 'news','memberships','plans','stock','trades','settlements'])
function title(row: Row) { return row.kind ? row.kind==='issue'?'办卡申请':'补卡申请' : String(row.name || row.title || row.operation || row.subjectName || row.category || row.displayName || row.action || row.id) }
function metadata(row: Row) {
 const extra: Record<string,string> = { plotName:'地块',occurredAt:'作业时间（UTC）',note:'记录说明',acceptanceNote:'验收或争议说明',source:'记录来源',feeFen:row.kind?'办卡/补卡报价':'会员费用' }
 return ['plotName','areaMu','crop','address','occurredAt','source','note','scheduledDate','description','reply','body','standardText','completionNote','acceptanceNote','reason','reviewNote','cancellationNote','cancelledAt','oldCardId','newCardId','traceId','grade','quantityKg','availableKg','unitPriceFenKg','feeFen','amountFen','platformAmountFen','centerAmountFen','expiresAt','countyCode','parentId','subMchid'].filter(k=>row[k]!=null&&row[k]!=='').map(k=>`${extra[k]||labels[k]||k}：${k==='source'&&row[k]==='manual'?'人工记录':['feeFen','amountFen','platformAmountFen','centerAmountFen'].includes(k)?`${(Number(row[k])/100).toFixed(2)}元`:row[k]}`).join(' · ')
}
export default function ConnectedWorkspace() {
  const location=useLocation(), navigate=useNavigate(), route=resolveConnectedPath(location.pathname)
  const [me, setMe] = useState<Me | null>(null), [boot, setBoot] = useState(true)
  const [username, setUsername] = useState(''), [password, setPassword] = useState('')
  const [moduleId, setModuleId] = useState('plots'), [items, setItems] = useState<Row[]>([]), [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0)
  const [plots, setPlots] = useState<Row[]>([]), [standards, setStandards] = useState<Row[]>([]), [roles, setRoles] = useState<Row[]>([]), [subjects, setSubjects] = useState<Row[]>([])
  const pending = useRef<{ fingerprint: string; key: string } | null>(null)
  const [dialog, setDialog] = useState<{ title: string; path: string; body: Row; version?: number; method: string; fields: string[]; identity: string } | null>(null)
  const [dialogValues, setDialogValues] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [cards, setCards] = useState<Row[]>([]), [historyCard, setHistoryCard] = useState<Row | null>(null)
  const [options,setOptions]=useState<Record<string,Row[]>>({}),[tradeHistory,setTradeHistory]=useState<{id:string;rows:Row[]}|null>(null)
  const [page, setPage] = useState(1), [pagination, setPagination] = useState<Page | null>(null), [loading, setLoading] = useState(false)
  const enabled = me ? modules.filter(m => permits(me, m.permission)) : []
  const active = !route.available ? undefined : route.module ? enabled.find(m=>m.id===route.module) : enabled.find(m => m.id === moduleId) || enabled[0]
  const identity = me?.identities.find(i => i.id === me.activeIdentityId)
  const scope = useRef(''); scope.current = me?.activeIdentityId || ''
  useEffect(() => { const previous = document.title; document.title = '乡桥农事 · 数据库联调工作台'; return () => { document.title = previous } }, [])
  const report = useCallback(function reportError(e: unknown) { setError(e instanceof BackendError ? `${e.message}${e.traceId ? `（追踪号 ${e.traceId}）` : ''}` : e instanceof Error ? e.message : '请求失败'); if (e instanceof BackendError && e.status === 401) { setMe(null); setItems([]); setDialog(null) } if (e instanceof BackendError && e.errorCode === 'XQ-IDENTITY-409') { const expected=scope.current;setItems([]); setDialog(null); setForm({}); request<Me>('/users/me').then(value=>{if(scope.current===expected)setMe(value)}).catch(reportError) } }, [])
  useEffect(() => { const controller = new AbortController(); request<Me>('/users/me', { signal: controller.signal }).then(value=>{if(!controller.signal.aborted)setMe(value)}).catch(e => { if (!controller.signal.aborted && e instanceof BackendError && e.status !== 401) report(e) }).finally(() => {if(!controller.signal.aborted)setBoot(false)}); return () => controller.abort() }, [report])
  useEffect(() => { setQuery(''); setForm({}); setDialog(null);setHistoryCard(null);setTradeHistory(null); pending.current = null }, [me?.activeIdentityId, active?.id])
  useEffect(() => {
    if (!me || !active) {setItems([]);setPagination(null);setLoading(false);return}
    const controller = new AbortController(), options = { signal: controller.signal, identity: me.activeIdentityId }; setItems([]); setPagination(null); setError(''); setLoading(true);setPlots([]);setStandards([]);setRoles([]);setSubjects([]);setOptions({})
    const jobs: Promise<unknown>[] = [request<Page | Row[]>(pagedModules.has(active.id) ? listPath(active.path, page) : active.path, options).then(data => { if (!controller.signal.aborted) { setItems(pageRows(data)); setPagination(Array.isArray(data) ? null : data) } })]
    if (active.fields?.includes('plotId')&&permits(me,'plots.read')) jobs.push(request<Page>('/plots?size=100', options).then(data => { if (!controller.signal.aborted) setPlots(pageRows(data)) }))
    if (active.fields?.includes('standardId')) jobs.push(request<Row[]>('/service-standards', options).then(data => { if (!controller.signal.aborted) setStandards(data) }))
    if (active.fields?.includes('role')) jobs.push(request<Row[]>('/role-catalog', options).then(data => { if (!controller.signal.aborted) setRoles(data) }))
    if (active.id === 'plots' && me.permissions.includes('center.manage')) jobs.push(request<Row[]>('/admin/subjects', options).then(data => { if (!controller.signal.aborted) setSubjects(data) }))
    if (active.id === 'cardRequests' && permits(me,'cards.request')) jobs.push(request<Page>('/cards?size=100',options).then(data=>{if(!controller.signal.aborted)setCards(pageRows(data))}));else setCards([])
    for(const [field,path] of active.id==='memberships'&&permits(me,'membership.apply')?[['planId','/membership-plans?size=100']]:active.id==='trades'&&permits(me,'trade.buy')?[['batchId','/stock-batches?size=100']]:active.id==='settlements'?[['orderId','/trade-orders?size=100'],['merchants','/admin/merchants']]:[]){jobs.push(request<Page|Row[]>(path,options).then(data=>{if(!controller.signal.aborted)setOptions(current=>({...current,[field]:pageRows(data)}))}))}
    Promise.all(jobs).catch(e => { if (!controller.signal.aborted) report(e) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [me, active, reload, page, report])
  async function login(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { setMe(await request<Me>('/auth/password/login', { method: 'POST', body: { username, password } })); setPassword(''); setNotice('已连接数据库；身份与权限由服务端返回。') } catch (e) { report(e) } finally { setBusy(false) } }
  async function switchIdentity(id: string) { setBusy(true); setItems([]); setError(''); setDialog(null); try { setMe(await request<Me>(`/identities/${encodeURIComponent(id)}/switch`, { method: 'POST', body: {} })); setPage(1); setNotice('已切换身份，重新加载当前主体的数据。') } catch (e) { report(e); setReload(n => n + 1) } finally { setBusy(false) } }
  async function logout() { setBusy(true); try { await request('/auth/logout', { method: 'POST', body: {} }); setMe(null); setItems([]); setForm({}); setNotice('已撤销服务端会话。') } catch (e) { report(e) } finally { setBusy(false) } }
  async function write(path: string, body: Row, method = 'POST', version?: number) {
    if (busy) return
    const ownScope = scope.current, fingerprint = JSON.stringify([ownScope, path, body, method, version])
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, key: writeKey() }
    setBusy(true); setError(''); setNotice('')
    try { await request(path, { method, body, key: pending.current.key, version, identity: ownScope }); pending.current = null; if (scope.current === ownScope) { if(path==='/admin/centers')setMe(await request<Me>('/users/me'));setNotice('服务端已确认保存。'); setDialog(null); setForm({}); setPage(1); setReload(n => n + 1) } }
    catch (e) { report(e) } finally { setBusy(false) }
  }
  function submit(event: FormEvent) {
    event.preventDefault(); if (!active) return
    const body: Row = { ...form }
    for(const field of Object.keys(body))if(numericFields.has(field))body[field]=Number(body[field])
    if(active.id==='cardRequests'&&body.kind==='issue')delete body.oldCardId
    if (active.id === 'records') { body.clientSeq = body.clientSeq || writeKey(); body.occurredAt = body.occurredAt || new Date().toISOString(); setForm(f => ({ ...f, clientSeq: String(body.clientSeq), occurredAt: String(body.occurredAt) })) }
    if (active.id === 'social') return void write(`/admin/social-accounts/${encodeURIComponent(form.channel || '')}`, { displayName: form.displayName, url: form.url, enabled: form.enabled === 'true' }, 'PUT')
    if(active.id==='trades'){const batch=options.batchId?.find(b=>b.id===body.batchId);if(!batch)return setError('请选择可见库存批次');return void write('/trade-orders',body,'POST',Number(batch.version))}
    void write(active.createPath||active.path.split('?')[0], body)
  }
  const canCreate = me && active && (active.write?permits(me,active.write):active.id === 'cardRequests' ? permits(me,'cards.request') : active.id === 'plots' ? permits(me, 'plots.write') : active.id === 'records' ? permits(me, 'records.write') : active.id === 'requests' ? permits(me, 'services.request') : !!active.fields)
  function choices(field: string): Row[] | undefined {
    if (field === 'kind') return [{id:'issue',name:'办卡（100元/张）'},{id:'replacement',name:'补卡（100元/张；需先挂失）'}]
    if (field === 'oldCardId') return cards.filter(c=>c.status==='lost').map(c=>({id:c.id,name:String(c.id)}))
    if (field === 'plotId') return plots.filter(p => active?.id !== 'requests' || p.status === 'verified')
    if (field === 'standardId') return standards.map(s => ({ id: s.id, name: `${s.operation} · V${s.revision}` }))
    if (field === 'role') return roles
    if (field === 'subjectId') return subjects
    if (field === 'channel') return [{ id: 'wechat_video', name: '视频号' }, { id: 'douyin', name: '抖音' }, { id: 'xiaohongshu', name: '小红书' }]
    if (field === 'enabled') return [{ id: 'false', name: '停用' }, { id: 'true', name: '启用' }]
    if(field==='planId')return options.planId||[]
    if(field==='batchId')return (options.batchId||[]).filter(b=>Number(b.availableKg)>0).map(b=>({...b,name:`${b.product} · ${b.grade} · 可用${b.availableKg}千克 · ${b.id}`}))
    if(field==='orderId')return (options.orderId||[]).filter(o=>o.status==='accepted').map(o=>({...o,name:`${o.product} · ${(Number(o.amountFen)/100).toFixed(2)}元 · ${o.id}`}))
    if(field==='platformMerchantId'||field==='centerMerchantId')return (options.merchants||[]).filter(m=>field!=='centerMerchantId'||m.centerId===identity?.centerId).map(m=>({...m,name:`${m.displayName} · ${m.subMchid}`}))
  }
  async function showHandovers(id:string){const own=scope.current;setBusy(true);try{const page=await request<Page>(`/trade-orders/${encodeURIComponent(id)}/handovers?size=100`,{identity:own});if(scope.current===own)setTradeHistory({id,rows:pageRows(page)})}catch(e){report(e)}finally{setBusy(false)}}
  function openDialog(title: string, path: string, body: Row, version?: number, fields: string[] = [], method = 'POST', values: Record<string,string> = {}) { setDialogValues(values); setDialog({ title, path, body, version, fields, method, identity: scope.current }); setError('') }
  function confirmDialog(event: FormEvent) { event.preventDefault(); if (!dialog || busy) return; if (dialog.identity !== scope.current) { setDialog(null); setError('身份已改变，请重新确认。'); return } void write(dialog.path, { ...dialog.body, ...dialogValues }, dialog.method, dialog.version) }
  function action(row: Row, label: string, path: string, body: Row, version = true) { return <button disabled={busy} key={label} onClick={() => openDialog(label, path, body, version ? Number(row.version) : undefined)}>{label}</button> }
  function rowActions(row: Row) {
    if (!me || !active) return null
    const id = encodeURIComponent(String(row.id))
    if (active.id === 'plots' && row.status === 'pending' && permits(me, 'plots.verify')) return <>{action(row, '核验通过', `/admin/plots/${id}/verify`, { approved: true })}{action(row, '驳回', `/admin/plots/${id}/verify`, { approved: false })}</>
    const actions = Array.isArray(row.availableActions) ? row.availableActions : []
    if(active.id==='memberships')return <>{actions.includes('cancel')&&<button disabled={busy} onClick={()=>openDialog('撤回会员申请',`/memberships/${id}/cancel`,{},Number(row.version),['note'])}>撤回申请（不等于退款）</button>}{['approve','reject'].filter(a=>actions.includes(a)).map(a=><button key={a} disabled={busy} onClick={()=>openDialog(a==='approve'?'批准会员申请':'驳回会员申请',`/admin/memberships/${id}/review`,{approved:a==='approve'},Number(row.version),['reviewNote'])}>{a==='approve'?'批准会员':'驳回会员'}</button>)}</>
    if(active.id==='trades')return <>{[['seller-confirm','卖方确认'],['dispatch','登记发货'],['accept','买方验收'],['dispute','提出交接争议'],['cancel','取消采购']].filter(([a])=>actions.includes(a)).map(([a,label])=><button key={a} disabled={busy} onClick={()=>openDialog(label,`/trade-orders/${id}/${a}`,{},Number(row.version),['note'])}>{label}</button>)}<button disabled={busy} onClick={()=>void showHandovers(String(row.id))}>交接历史</button></>
    if(active.id==='centers'&&row.id!==identity?.centerId)return action(row,row.status==='active'?'停用中心及下级访问':'恢复中心',`/admin/centers/${id}/status`,{active:row.status!=='active'})
    if (active.id === 'requests') return <>{actions.includes('claim')&&action(row, '接单', `/service-requests/${id}/claim`, {})}{actions.includes('cancel')&&<button disabled={busy} onClick={()=>openDialog('取消未接单需求',`/service-requests/${id}/cancel`,{},Number(row.version),['note'])}>取消未接单需求</button>}</>
    if (active.id === 'orders') return <>{actions.includes('check-in') && action(row, '开工', `/work-orders/${id}/check-in`, {})}{actions.includes('submit') && <button disabled={busy} onClick={() => openDialog('提交完工', `/work-orders/${id}/submit`, {}, Number(row.version), ['note'])}>提交完工</button>}{['accept', 'dispute'].filter(a => actions.includes(a)).map(a => <button key={a} disabled={busy} onClick={() => openDialog(a === 'accept' ? '验收确认' : '提出争议', `/work-orders/${id}/${a}`, {}, Number(row.version), ['note'])}>{a === 'accept' ? '验收确认' : '提出争议'}</button>)}</>
    if (active.id === 'tickets' && permits(me, 'help.manage')) return <button disabled={busy} onClick={() => openDialog('回复帮助工单', `/help-tickets/${id}/reply`, { status: 'resolved' }, Number(row.version), ['reply'])}>回复并通知用户</button>
    if (active.id === 'messages' && !row.read) return action(row, '标为已读', `/messages/${id}/read`, {}, false)
    if (active.id === 'applications' && row.status === 'pending' && permits(me, 'identities.manage')) return <>{action(row, '批准身份', `/admin/identity-applications/${id}/review`, { approved: true })}{action(row, '驳回申请', `/admin/identity-applications/${id}/review`, { approved: false })}</>
    if (active.id === 'news') return action(row, row.status === 'published' ? '撤回发布' : '发布', `/admin/news/${id}/${row.status === 'published' ? 'withdraw' : 'publish'}`, {})
    if(active.id==='cardRequests')return <>{actions.includes('cancel')&&action(row,'取消申请',`/card-requests/${id}/cancel`,{})}{['approve','reject'].filter(a=>actions.includes(a)).map(a=><button key={a} disabled={busy} onClick={()=>openDialog(a==='approve'?'批准办卡申请':'驳回办卡申请',`/admin/card-requests/${id}/review`,{approved:a==='approve'},Number(row.version),['reviewNote'])}>{a==='approve'?'批准申请':'驳回申请'}</button>)}{actions.includes('register')&&action(row,'云端登记与绑定',`/admin/card-requests/${id}/register`,{})}</>
    if(active.id==='cards')return <>{actions.includes('configure')&&<button disabled={busy} onClick={() => openDialog('设置 A/B/C', `/cards/${id}/configuration`, {}, Number(row.desiredConfigVersion), ['A', 'B', 'C'], 'PUT', row.configuration as Record<string,string>)}>设置 A/B/C（待设备同步）</button>}{[['report-loss','挂失'],['restore','恢复云端状态'],['retire','停用']].filter(([a])=>actions.includes(a)).map(([a,label])=><button key={a} disabled={busy} onClick={()=>openDialog(label,`/cards/${id}/lifecycle/${a}`,{},Number(row.version),['reason'])}>{label}</button>)}<button disabled={busy} onClick={()=>setHistoryCard(row)}>记录与历史</button></>
  }
  if (boot) return <main className="connected-page"><p>正在确认服务端会话…</p></main>
  return <div className="connected-page">
    <header><BrandLockup context="乡桥联调工作台" domain="nong.cloud"/><span className="connected-badge">PostgreSQL 本地联调</span></header>
    <div className="connected-boundary">此入口使用真实接口和数据库；原有原型保持独立。微信登录、实际收款分账、真实摄像头及设备签名尚未接通，不会显示已完成。</div>
    <details className="connected-diagnostics"><summary>连接诊断（跨域 / 数据格式）</summary><LocalCorsProbe/><p>字段统一 camelCase；作业时间为 UTC ISO 字符串，计划日期为 YYYY-MM-DD，面积为数字，未填写信息保持 null。身份及版本冲突不会自动覆盖。</p></details>
    {error && <p className="connected-error" role="alert">{error}</p>}{notice && <p role="status" className="connected-notice">{notice}</p>}
    {!me ? <form className="connected-login" onSubmit={login}><h1>登录乡桥</h1><p>一个账号可拥有多个已批准身份。</p><label>账号<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required/></label><label>密码<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required/></label><button className="primary" disabled={busy}>登录数据库工作台</button><small>本地账号由显式测试初始化生成；没有固定验证码登录。</small></form> : <>
      <div className="connected-account"><div><strong>{me.user.name}</strong><small>{identity?.centerName} · {identity?.org}</small></div><label>当前身份<select disabled={busy} value={me.activeIdentityId} onChange={e => void switchIdentity(e.target.value)}>{me.identities.map(i => <option key={i.id} value={i.id}>{i.label} · {i.org}</option>)}</select></label><button disabled={busy} onClick={() => void logout()}>统一退出</button></div>
      <WorkGuidance key={me.activeIdentityId} identity={me.activeIdentityId}/>
      <div className="connected-layout"><nav aria-label="联调业务模块">{enabled.map(m => <button aria-current={active?.id === m.id ? 'page' : undefined} key={m.id} disabled={busy} onClick={() => { if (active?.id === m.id) return; setItems([]); setPagination(null); setLoading(true); setModuleId(m.id);setHistoryCard(null);setDialog(null);navigate(connectedPath(m.id)); setPage(1); setNotice('') }}>{m.title}</button>)}</nav><main>
        <div className="connected-title"><h1>{active?.title||'页面接入状态'}</h1><button disabled={busy} onClick={() => setReload(n => n + 1)}>刷新</button></div>
        {!active&&<section className="connected-boundary" role="alert"><h2>{route.available?'当前身份不能访问此模块':'此页面尚未接入数据库'}</h2><p>路径：{location.pathname}。不会跳到不相关业务，也不会读取演示草稿。请从左侧选择已接通且当前身份有权访问的模块，或切换服务端已批准身份。</p></section>}
        {canCreate && <form className="connected-form" onSubmit={submit}>{[...(active.fields || []), ...(active.id === 'plots' && permits(me, 'center.manage') ? ['subjectId'] : [])].filter(field=>field!=='oldCardId'||form.kind==='replacement').map(field => <label key={field}>{labels[field] || field}{choices(field) ? <select required value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })}><option value="">请选择</option>{choices(field)!.map(c => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}</select> : ['description', 'body', 'reason', 'note'].includes(field) ? <textarea maxLength={field === 'body' ? 20000 : 2000} required={field !== 'note'} value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })}/> : <input maxLength={field === 'url' ? 500 : 300} type={field === 'scheduledDate' ? 'date' : field === 'areaMu' ? 'number' : 'text'} min={field === 'areaMu' ? '0.0001' : undefined} step={field === 'areaMu' ? '0.0001' : undefined} required={field !== 'url'} value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })}/>}</label>)}<button className="primary" disabled={busy || loading}>提交到数据库</button></form>}
        {active?.id === 'cards' && <p>云端配置不等于设备已确认；上传事件仅为未验证采集证据，不代表作业质量合格。</p>}
        {active?.id === 'cardRequests' && <p>办卡、补卡均100元/张，仅为费用报价，支付未接通。批准申请后可登记云端卡并绑定当前主体，不代表实物交付或设备激活。家庭代办须另行授权，不能自行办卡。</p>}
        {active?.id === 'orders' && <p>执行标准已冻结。服务方提交完工后，由种植主体独立验收，不能跨身份自验收。</p>}
        {active?.id === 'requests' && <p>仅发起人可取消未被接单的需求。取消原因留痕；已接单需求须协商处理，不能直接取消正在执行的工单。</p>}
        {['memberships','plans'].includes(active?.id||'')&&<p>身份审批不等于会员生效。免费方案审核后可生效；收费方案只能待付款，支付未接通。种植户/合作社平台会员费必须为0。方案不可覆盖修改。</p>}
        {['stock','trades'].includes(active?.id||'')&&<p>等级和库存由卖方申报，尚无检测/货权凭据核验。采购按千克计量，金额为整数分，报价由服务端冻结。交接时核对计量、等级、损耗与凭据；验收不代表付款或质量认证。争议订单继续保留库存锁定，人工调解及退款尚未接通。</p>}
        {active?.id==='centers'&&<p>仅创建当前中心的下级业务中心，自动为当前管理员绑定下级管理身份；请刷新身份后切换。此登记不是工商分公司设立。父中心停用时下级访问同步禁止。</p>}
        {['merchants','settlements'].includes(active?.id||'')&&<p>商户与分账仅在管理后台。商户号录入不等于支付侧核验；分账仅计算商户侧服务收入计划，不从农户货款扣平台服务费。比例须明确设置；不会执行收款或分账。</p>}
        <label className="connected-list-filter">筛选本页记录<input placeholder="仅筛选本页，不是全库搜索" value={query} onChange={e => setQuery(e.target.value)}/></label>
        {loading && <p role="status">正在读取当前身份的数据库记录…</p>}
        {pagination && <div className="connected-pagination" aria-label="数据库分页"><span>共 {pagination.total} 条 · 第 {pagination.page} 页 · 每页 {pagination.size} 条</span><button disabled={busy || loading || page <= 1} onClick={() => { setItems([]); setLoading(true); setPage(p => p - 1); setQuery('') }}>上一页</button><button disabled={busy || loading || !pagination.hasNext} onClick={() => { setItems([]); setLoading(true); setPage(p => p + 1); setQuery('') }}>下一页</button></div>}
        <section className="connected-results" aria-label="数据库记录">{items.filter(row => !query || JSON.stringify(row).toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((row, index) => <article key={String(row.id || row.channel || index)}><div><h2>{title(row)}</h2><span className="connected-badge">{row.expired?'已过期':statusLabels[String(row.status)] || (row.read === true ? '已读' : row.read === false ? '未读' : String(row.status || '数据库记录'))}</span></div><p>{metadata(row)}</p>{active?.id === 'cards' && <><p>配置：云端 V{String(row.desiredConfigVersion)} / 设备确认 V{String(row.acknowledgedConfigVersion)}</p><p>{['A','B','C'].map(k => `${k} 键：${(row.configuration as Record<string,string>)?.[k] || '未设置'}`).join(' · ')}</p></>}<small>编号：{String(row.id || row.channel)}{row.version != null ? ` · 版本 ${row.version}` : ''}</small><div className="connected-actions">{rowActions(row)}</div></article>)}{!loading && !items.length && !error && <p className="connected-empty">暂无可见记录。仅显示当前身份有权访问的数据。</p>}{!loading && items.length > 0 && query && !items.some(row => JSON.stringify(row).toLocaleLowerCase().includes(query.toLocaleLowerCase())) && <p>本页没有匹配记录，请清空筛选或翻页。</p>}</section>
        <p className="connected-footnote">业务列表采用真实数据库分页；日志为最近100条，下拉选项暂限前100个对象。农户平台服务费为0，办卡/补卡100元；此联调版不收款。会员、库存采购、交接和中心已落库；真实支付分账、产季成本、家庭委托与云农场仍待接入。</p>
      </main></div>
    </>}
    {dialog && <ContentDialog title={dialog.title} onClose={() => { if (!busy) setDialog(null) }} notice={error}><form className="connected-dialog-form" onSubmit={confirmDialog}><p>此操作会写入本地数据库，请核对当前主体及对象版本。不是收款、实物交付、设备激活或法定认证。</p>{dialog.fields.map(field => <label key={field}>{field === 'reply' ? '回复内容' : field === 'note' ? '执行或验收说明' : labels[field] || `${field} 键作业`}<textarea autoFocus={field === dialog.fields[0]} required maxLength={['A','B','C'].includes(field) ? 80 : 2000} value={dialogValues[field] || ''} onChange={e => setDialogValues({ ...dialogValues, [field]: e.target.value })}/></label>)}<button className="primary" disabled={busy}>确认提交</button><button type="button" disabled={busy} onClick={() => setDialog(null)}>取消</button></form></ContentDialog>}
    {historyCard&&me&&<CardHistoryDialog card={historyCard} identity={me.activeIdentityId} onClose={()=>setHistoryCard(null)}/>}
    {tradeHistory&&<ContentDialog title="采购交接历史" onClose={()=>setTradeHistory(null)}><p>订单 {tradeHistory.id} · 最近100条，只读留痕；不等于收款凭证。</p>{tradeHistory.rows.map(row=><div className="connected-history-row" key={String(row.id)}><strong>{String(row.action)}</strong><p>{String(row.note)}</p><small>{String(row.createdAt)}</small></div>)}</ContentDialog>}
  </div>
}
