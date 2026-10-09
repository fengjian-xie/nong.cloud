import { lazy, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../brand/BrandLockup'
import { ArrowUpRight, CheckCircle2, Plus, Radio, ShieldCheck } from 'lucide-react'
import { useFarm } from '../farm/FarmProvider'
import { available, costEstimate, money, now, operationOptions, uid } from '../farm/model'
import type { Card, CostInput, Evidence } from '../farm/model'
import { Modal, Panel, SearchField, Stats, Table, Tag } from '../farm/ui'
import { getRole, moduleLabels, rolePath } from './config'
import type { ModuleId, Role } from './config'
import { publicOffers, scopedBatches, scopedJobs, scopedPlots } from './model'
import type { ServiceJob, ServiceProvider } from './model'
import { usePortal } from './PortalProvider'
import { isValueView, type ValueView } from '../value/model'
const RoleValuePage = lazy(() => import('../value/ValueWorkspace').then(m => ({ default: m.RoleValuePage })))

function Heading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="farm-eyebrow">乡桥农事 · 角色业务</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}
function DialogForm({ title, close, submit, children, button = '保存演示数据' }: { title: string; close: () => void; submit: () => boolean; children: ReactNode; button?: string }) {
  const { notice } = usePortal()
  const [attempted, setAttempted] = useState(false)
  const handleSubmit = (event: FormEvent) => { event.preventDefault(); setAttempted(true); if (submit()) close() }
  return <Modal title={title} onClose={close}><form className="farm-form" onSubmit={handleSubmit}>{children}{attempted && notice && <p className="farm-warning" role="alert">{notice}</p>}<p className="farm-hint">仅保存本机演示数据，无真实付款、硬件读取或文件上传。</p><div className="farm-form-actions"><button type="button" className="secondary-button" onClick={close}>取消</button><button type="submit" className="primary-button">{button}</button></div></form></Modal>
}
function ScopePlotSelect({ role, value, change }: { role: Role; value: string; change: (value: string) => void }) {
  const { state: farm } = useFarm(); const { state } = usePortal()
  return <label>授权地块<select required value={value} onChange={e => change(e.target.value)}>{scopedPlots(farm, state, role.id).map(p => <option value={p.id} key={p.id}>{p.name} · {p.owner}</option>)}</select></label>
}

function Plots({ role }: { role: Role }) {
  const { state: farm } = useFarm(); const { state, farmCommit } = usePortal()
  const plots = scopedPlots(farm, state, role.id)
  const [query, setQuery] = useState(''); const [selected, setSelected] = useState('')
  const [crop, setCrop] = useState(''); const [reason, setReason] = useState(''); const [evidence, setEvidence] = useState<Evidence[]>([])
  const visible = plots.filter(p => `${p.name}${p.crop}${p.owner}`.includes(query))
  function files(files: FileList | null, kind: Evidence['kind']) { setEvidence(es => [...es.filter(e => e.kind !== kind), ...Array.from(files || []).filter(f => f.type.startsWith(kind === 'image' ? 'image/' : 'video/')).map(f => ({ name: f.name, kind, size: f.size }))]) }
  return <div className="farm-page"><Heading title={moduleLabels.plots} description="历年种植留档；作物变更必须带照片、视频，提交后由运营核验，不自我认证。"/><SearchField value={query} onChange={setQuery} placeholder="搜索授权地块、作物或社员"/>
    <div className="portal-plot-grid">{visible.map(p => <article className="panel portal-plot" key={p.id}><div><Tag tone="gray">{p.season}</Tag><span>{p.id}</span></div><h2>{p.name}</h2><p>{p.owner} · {p.town}</p><h3>{p.crop}</h3><dl><div><dt>面积</dt><dd>{p.area} 亩</dd></div><div><dt>海拔 / 示例</dt><dd>{p.altitude} m</dd></div><div><dt>预计成熟</dt><dd>{p.harvest}</dd></div><div><dt>预估产量</dt><dd>{p.yieldKg.toLocaleString()} kg</dd></div></dl><p className="farm-hint">GPS测绘、面积与海拔采集接口待接入；当前不是实测数据。</p><details><summary>历年种植档案 · {p.archive.length}条</summary>{p.archive.map(a => <p key={a.year}>{a.year} · {a.crop} · {a.yieldKg.toLocaleString()} kg</p>)}</details><div className="portal-card-actions"><Tag tone={p.forecastPending ? 'amber' : 'green'}>{p.forecastPending ? '成熟期与产量待复核' : `档案 v${p.version}`}</Tag><button className="secondary-button" onClick={() => { setSelected(p.id); setCrop(p.crop); setReason(''); setEvidence([]) }}>申请种植变更</button></div></article>)}</div>
    {!visible.length && <div className="farm-empty">没有匹配的授权地块</div>}
    <Panel title="我的变更申请" caption="照片视频只保存文件名、类型、大小，未实际上传"><Table headers={['地块', '新作物', '原因', '附件', '状态']} empty={!farm.changes.some(c => plots.some(p => p.id === c.plotId))}>{farm.changes.filter(c => plots.some(p => p.id === c.plotId)).map(c => <tr key={c.id}><td>{c.plotId}</td><td>{c.crop}</td><td>{c.reason}</td><td>{c.evidence.length}个</td><td><Tag tone="amber">{c.status}</Tag></td></tr>)}</Table></Panel>
    {selected && <DialogForm title="申请种植变更" close={() => setSelected('')} submit={() => farmCommit(role.id, { type: 'cropChange', change: { id: uid('CHANGE'), plotId: selected, crop, reason, evidence } })}><label>新种植产品<input required value={crop} onChange={e => setCrop(e.target.value)}/></label><label>变更说明<textarea required minLength={5} value={reason} onChange={e => setReason(e.target.value)}/></label><label>照片（单张≤10MB）<input type="file" accept="image/*" multiple required onChange={e => files(e.target.files, 'image')}/></label><label>视频（单个≤100MB）<input type="file" accept="video/*" required onChange={e => files(e.target.files, 'video')}/></label></DialogForm>}
  </div>
}

function Records({ role }: { role: Role }) {
  const { state: farm } = useFarm(); const { state } = usePortal(); const [query, setQuery] = useState('')
  const plots = scopedPlots(farm, state, role.id)
  const rows = farm.records.filter(r => plots.some(p => p.id === (r.review?.plotId || r.plotId) && p.owner === r.farmer)).filter(r => `${r.id}${r.operation}${r.farmer}`.includes(query))
  const receipts = state.sales.filter(s => plots.some(p => p.owner === s.customer))
  return <div className="farm-page"><Heading title="农事记录" description="保留原始采集事件与核验结果。离线保存和低精度定位不冒充已核验记录。"/><SearchField value={query} onChange={setQuery} placeholder="搜索我的记录、作业或授权农户"/><Panel title="授权农事事件" caption="只显示农户身份与地块归属都匹配的示例记录"><Table headers={['采集时间', '作业 / 来源', '农户 / 地块', '定位精度', '同步与核验']} empty={!rows.length}>{rows.map(r => <tr key={r.id}><td>{r.at}<small>{r.id}</small></td><td>{r.operation}<small>{r.source} · 按键v{r.configVersion}</small></td><td>{r.farmer}<small>{r.review?.plotId || r.plotId}</small></td><td>{r.accuracy === null ? '未获取定位' : `±${r.accuracy} m`}</td><td><Tag tone={r.synced ? 'green' : 'amber'}>{r.synced ? '已同步' : '卡内离线'}</Tag> <Tag tone={r.status === '已核验' ? 'green' : 'amber'}>{r.status}</Tag></td></tr>)}</Table></Panel><Panel title="农资购买凭据" caption="门店销售可联动显示，但购买不代表已经在该地块施用"><Table headers={['时间', '商品 / 批次', '购买人', '数量', '登记金额']} empty={!receipts.length}>{receipts.map(s => <tr key={s.id}><td>{s.at}</td><td>{s.product}<small>{s.batch}</small></td><td>{s.customer}</td><td>{s.quantity} {s.unit}</td><td>¥{money(s.amount)}</td></tr>)}</Table></Panel></div>
}

function Cards({ role }: { role: Role }) {
  const { state: farm } = useFarm(); const { state, farmCommit } = usePortal()
  const owners = scopedPlots(farm, state, role.id).map(p => p.owner)
  const cards = farm.cards.filter(c => owners.includes(c.farmer))
  const [selected, setSelected] = useState<Card | null>(null); const [keys, setKeys] = useState<Card['keys']>(['施肥', '灌溉', '修剪'])
  const editable = role.id !== 'family' || state.family.configure
  return <div className="farm-page"><Heading title={role.id === 'cooperative' ? '社员农事卡' : '我的农事卡'} description="开工 / 收工为固定按键，A、B、C可配置；官网与小程序将使用同一配置版本接口。"/><div className="portal-plot-grid">{cards.map(c => <article className="panel portal-card-device" key={c.id}><div className="portal-device-face"><div><SproutMark/><Tag>{c.status}</Tag></div><h2>乡桥农事记录卡</h2><p>{c.farmer} · {c.id}</p><div className="portal-physical-keys"><span>开工</span>{c.keys.map((k, i) => <span key={i}><strong>{['A', 'B', 'C'][i]}</strong>{k}</span>)}<span>收工</span></div><small>GPS定位 · 蓝牙同步 · NFC衔接 / 实物未接入</small></div><dl className="portal-device-info"><div><dt>电量 / 示例</dt><dd>{c.battery}%</dd></div><div><dt>待上传</dt><dd>{c.pending}条</dd></div><div><dt>云端配置</dt><dd>v{c.version}</dd></div><div><dt>设备回执</dt><dd>v{c.deviceVersion}</dd></div></dl><p className="farm-hint">上次同步：{c.lastSync}。配置下发不代表实物已更新。</p><div className="portal-card-actions"><button className="secondary-button" disabled={!editable || c.status !== '已激活'} onClick={() => { setSelected(c); setKeys([...c.keys]) }}>设置A/B/C</button><button className="primary-button" disabled={!editable || c.status !== '已激活'} onClick={() => farmCommit(role.id, { type: 'sync', id: c.id })}>模拟蓝牙同步</button></div></article>)}</div>{!editable && <div className="farm-warning">您只有查看权限；请由种植户在“家庭授权”中开放卡片代办。</div>}{!cards.length && <div className="farm-empty">当前授权范围没有绑定卡片。首次激活需本人同意并由运营端完成绑定。</div>}
    {selected && <DialogForm title="设置A/B/C作业键" close={() => setSelected(null)} submit={() => farmCommit(role.id, { type: 'configure', id: selected.id, keys })}><p>{selected.farmer} · {selected.id}</p>{keys.map((key, index) => <label key={index}>{['A', 'B', 'C'][index]}键作业<select value={key} onChange={e => setKeys(previous => previous.map((v, i) => i === index ? e.target.value : v) as Card['keys'])}>{operationOptions.map(o => <option key={o}>{o}</option>)}</select></label>)}<p className="farm-hint">新配置需蓝牙连接时同步到卡。旧记录始终保留采集时的配置版本。</p></DialogForm>}
  </div>
}
function SproutMark() { return <span className="portal-device-brand"><BrandMark reverse/> 乡桥农业 · nong.cloud</span> }

function ServiceEvidence({ role }: { role: Role }) {
  const { state: farm } = useFarm(); const { state } = usePortal()
  const plots = scopedPlots(farm, state, role.id)
  const jobs = state.services.filter(j => j.completion && (plots.some(p => p.id === j.plotId) || scopedJobs(state, role.id).some(own => own.id === j.id)))
  return <div className="farm-page portal-evidence"><Panel title="关联服务履约凭据" caption="完工说明、专业明细与委托方验收分开保存；不覆盖农事卡原始事件，不等同质量认证"><Table headers={['作业 / 地块', '服务主体', '完工说明', '状态', '专业记录']} empty={!jobs.length}>{jobs.map(j => <tr key={j.id}><td>{j.operation}<small>{j.plotId} · {j.id}</small></td><td>{getRole(j.provider)?.actor}</td><td>{j.completion}</td><td><Tag tone={j.status === '已完成' ? 'green' : 'amber'}>{j.status}</Tag></td><td>{j.provider === 'protection' ? <details><summary>查看植保凭据</summary>{state.protection.filter(p => p.jobId === j.id).map(p => <p className="portal-proof" key={p.id}>{p.product} · 批次 {p.batch}<br/>总量 {p.amount} {p.unit} · 面积 {p.area}亩<br/>标签安全间隔 {p.safetyDays}天<br/>{p.note}<br/>登记时间 {p.at}</p>)}</details> : '通用完工说明；实物凭据未接入'}</td></tr>)}</Table></Panel></div>
}

function Costs({ role }: { role: Role }) {
  const { state: farm } = useFarm(); const { state, commit } = usePortal()
  const plot = scopedPlots(farm, state, role.id)[0]
  const [input, setInput] = useState<CostInput>(state.costs[plot?.id] || { days: 0, dayRate: 180, inputs: 0, services: 0, other: 0, yieldKg: plot?.yieldKg || 1, markup: 35 })
  let estimate: ReturnType<typeof costEstimate> | undefined
  try { estimate = costEstimate(input) } catch { /* Invalid draft values must not become a displayed price. */ }
  return <div className="farm-page"><Heading title="成本与自主定价" description="把家庭劳动算进去，为农户提供参考，不强制确定收购价、不对外公开个人成本。"/>{estimate && <Stats items={[{ label: '家庭劳动估值', value: `¥${money(estimate.labour)}`, detail: '确认出工人天 × 本地参考日工资' }, { label: '其他投入合计', value: `¥${money(estimate.cash)}`, detail: '含其他费用，不全是现金支出' }, { label: '完整成本 / kg', value: `¥${money(estimate.fullPerKg)}`, detail: '以预估产量分摊' }, { label: `成本 + ${input.markup}% 参考`, value: `¥${money(estimate.referencePrice)} / kg`, detail: '加价率，不是销售毛利率' }]} />}
    <Panel title={`${plot?.name || '地块'} · 本产季估算`} caption="当地行情暂为人工录入；35%只是可调整定价示例，并非核实的任何零售企业收购规则"><form className="farm-form" onSubmit={e => { e.preventDefault(); if (plot) commit(role.id, { type: 'cost', plotId: plot.id, input }) }}><div className="farm-form-grid">{([['days', '确认出工人天'], ['dayRate', '本地参考日工资 / 元'], ['inputs', '农资费用 / 元'], ['services', '农机农服费用 / 元'], ['other', '其他费用与折旧 / 元'], ['yieldKg', '预估产量 / kg'], ['markup', '成本加价率 / %']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" required min={key === 'yieldKg' ? 0.01 : 0} max={key === 'markup' ? 100 : 100000000} step="0.01" value={input[key]} onChange={e => setInput({ ...input, [key]: Number(e.target.value) })}/></label>)}</div><button className="primary-button" disabled={!estimate}>保存我的成本估算</button></form></Panel><p className="farm-hint">产量预测、行情、损耗、运输与税费均影响价格。成本估算不是保底收益承诺，不向采购商展示。</p></div>
}

function Services({ role }: { role: Role }) {
  const { state: farm } = useFarm(); const { state, commit } = usePortal()
  const [open, setOpen] = useState(false); const [plotId, setPlotId] = useState(scopedPlots(farm, state, role.id)[0]?.id || '')
  const [provider, setProvider] = useState<ServiceProvider>('team'); const [operation, setOperation] = useState('葡萄园修剪')
  const [area, setArea] = useState(1); const [date, setDate] = useState('2026-09-01'); const [note, setNote] = useState('')
  const [complete, setComplete] = useState(''); const [completion, setCompletion] = useState('')
  const requester = role.id === 'farmer' || role.id === 'cooperative'
  const rows = scopedJobs(state, role.id)
  function next(job: ServiceJob) { const status = ({ '待接单': '已接单', '已接单': '作业中' } as const)[job.status as '待接单' | '已接单']; if (status) commit(role.id, { type: 'serviceStatus', id: job.id, status }) }
  return <div className="farm-page"><Heading title="农事服务" description={requester ? '申请服务、查看进度，并在收到完工说明后确认验收。费用双方线下确认，平台不向农户收平台服务费。' : '只展示指派给本主体的订单。完工后进入待验收，不由服务方自验收。'} action={requester && <button className="primary-button" onClick={() => setOpen(true)}><Plus size={16}/>申请服务</button>}/><Panel title={requester ? '我的委托订单' : '指派给我的订单'} caption="待接单 → 已接单 → 作业中 → 待验收 → 已完成"><Table headers={['订单 / 作业', '委托地块', '面积与预约', '服务主体', '状态 / 完工说明', '操作']} empty={!rows.length}>{rows.map(j => <tr key={j.id}><td>{j.operation}<small>{j.id}</small></td><td>{farm.plots.find(p => p.id === j.plotId)?.name}<small>{j.note}</small></td><td>{j.area} 亩<small>{j.date}</small></td><td>{getRole(j.provider)?.actor}</td><td><Tag tone={j.status === '已完成' ? 'green' : 'amber'}>{j.status}</Tag>{j.completion && <small>{j.completion}</small>}</td><td><div className="farm-row-actions">{!requester && ['待接单', '已接单'].includes(j.status) && <button className="secondary-button" onClick={() => next(j)}>{j.status === '待接单' ? '接受订单' : '开始作业'}</button>}{!requester && j.status === '作业中' && <button className="primary-button" onClick={() => { setComplete(j.id); setCompletion('') }}>提交完工</button>}{requester && j.status === '待验收' && <button className="primary-button" onClick={() => commit(role.id, { type: 'serviceStatus', id: j.id, status: '已完成' })}>确认验收</button>}{requester && ['待接单', '已接单'].includes(j.status) && <button className="secondary-button" onClick={() => commit(role.id, { type: 'serviceStatus', id: j.id, status: '已取消' })}>取消委托</button>}</div></td></tr>)}</Table></Panel>
    {open && <DialogForm title="申请农事服务" close={() => setOpen(false)} submit={() => commit(role.id, { type: 'request', job: { id: uid('SRV'), plotId, provider, operation, area, date, note } })}><ScopePlotSelect role={role} value={plotId} change={setPlotId}/><label>服务方<select value={provider} onChange={e => setProvider(e.target.value as ServiceProvider)}><option value="team">狮子头农服队（演示）</option><option value="machine">赛岐农机服务站（演示）</option><option value="protection">赛岐专业植保队（演示）</option></select></label><label>作业内容<input required value={operation} onChange={e => setOperation(e.target.value)}/></label><div className="farm-form-grid"><label>作业面积 / 亩<input required type="number" min="0.01" step="0.01" max={farm.plots.find(p => p.id === plotId)?.area} value={area} onChange={e => setArea(Number(e.target.value))}/></label><label>预约日期<input required type="date" value={date} onChange={e => setDate(e.target.value)}/></label></div><label>交接说明<textarea value={note} onChange={e => setNote(e.target.value)}/></label></DialogForm>}
    {complete && <DialogForm title="提交完工说明" close={() => setComplete('')} submit={() => commit(role.id, { type: 'serviceStatus', id: complete, status: '待验收', completion })}><label>作业完成情况<textarea required minLength={5} value={completion} onChange={e => setCompletion(e.target.value)} placeholder="说明实际作业内容、面积与异常情况"/></label><p className="farm-hint">正式版需要作业照片、委托人确认与实物卡服务凭据。当前只保存演示说明。</p></DialogForm>}
  </div>
}

function Offers({ role }: { role: Role }) {
  const { state: farm } = useFarm(); const { state, commit } = usePortal()
  const [open, setOpen] = useState(false); const [plotId, setPlotId] = useState(scopedPlots(farm, state, role.id)[0]?.id || '')
  const [quantity, setQuantity] = useState(1000); const [price, setPrice] = useState(8.5)
  const plot = farm.plots.find(p => p.id === plotId)
  const rows = state.offers.filter(o => scopedPlots(farm, state, role.id).some(p => p.id === o.plotId))
  return <div className="farm-page"><Heading title="供货意向" description="农户主动发布成熟期、规模和意向价；采购商不获得个人成本、原始GPS或家庭信息。" action={<button className="primary-button" onClick={() => setOpen(true)}><Plus size={16}/>发布供货意向</button>}/><Panel title="我的公开供货" caption="种植档案版本变化或预测待核实后，旧货源停止向采购商展示"><Table headers={['产品 / 地块', '预计成熟', '意向数量', '意向价', '发布状态', '操作']} empty={!rows.length}>{rows.map(o => <tr key={o.plotId}><td>{o.crop}<small>{o.town} · {o.plotId}</small></td><td>{o.harvest}</td><td>{o.quantity.toLocaleString()} kg</td><td>¥{money(o.price)} / kg</td><td><Tag tone={publicOffers(farm, state).some(p => p.plotId === o.plotId) ? 'green' : 'amber'}>{publicOffers(farm, state).some(p => p.plotId === o.plotId) ? '对外可见' : o.status === '已撤回' ? '已撤回' : '档案待复核'}</Tag></td><td>{o.status === '已发布' && <button className="secondary-button" onClick={() => commit(role.id, { type: 'withdraw', plotId: o.plotId })}>撤回供货</button>}</td></tr>)}</Table></Panel><Panel title="产业带采购需求" caption="显示采购方自愿发布的产品、规格和补货量；当前是意向撮合，不产生交易"><Table headers={['需求方', '产品等级', '需求量', '到货日期', '备注']} empty={!state.demands.some(d => d.status === '征集中')}>{state.demands.filter(d => d.status === '征集中').map(d => <tr key={d.id}><td>{getRole(d.actor)?.actor}</td><td>{d.product} · {d.grade}</td><td>{d.quantity.toLocaleString()} kg</td><td>{d.date}</td><td>{d.note}</td></tr>)}</Table></Panel>
    {open && <DialogForm title="发布供货意向" close={() => setOpen(false)} submit={() => !!plot && commit(role.id, { type: 'offer', offer: { plotId, crop: plot.crop, town: plot.town, area: plot.area, harvest: plot.harvest, quantity, price, version: plot.version, status: '已发布' } })}><ScopePlotSelect role={role} value={plotId} change={setPlotId}/><p>产品：{plot?.crop} · 成熟期：{plot?.harvest} · 预计可供：{plot?.availableKg.toLocaleString()} kg</p><label>意向供货量 / kg<input type="number" required min="0.01" step="0.01" max={plot?.availableKg} value={quantity} onChange={e => setQuantity(Number(e.target.value))}/></label><label>意向价 / 元每kg<input type="number" required min="0.01" step="0.01" value={price} onChange={e => setPrice(Number(e.target.value))}/></label><p className="farm-hint">只公开上述必要信息；实际收获、等级、价格与交付需另行确认。</p></DialogForm>}
  </div>
}

function Maturity() {
  const { state: farm } = useFarm(); const { state, commit } = usePortal()
  const [query, setQuery] = useState(''); const [month, setMonth] = useState('全部')
  const offers = publicOffers(farm, state)
  const visible = offers.filter(o => `${o.crop}${o.town}`.includes(query) && (month === '全部' || o.harvest.slice(0, 7) === month))
  return <div className="farm-page"><Heading title="成熟货源" description="仅展示主动公开的供货意向。日期、规模为预测；当前为列表与成熟期分布，真实GIS地图待接入。"/><div className="portal-filter"><SearchField value={query} onChange={setQuery} placeholder="搜索公开产品或产地"/><label>成熟月份<select value={month} onChange={e => setMonth(e.target.value)}><option>全部</option>{[...new Set(offers.map(o => o.harvest.slice(0, 7)))].map(m => <option key={m}>{m}</option>)}</select></label></div><div className="portal-maturity-layout"><Panel title="产地供货概况" caption="没有发布的地块不展示，采购方看不到私有生产档案"><div className="portal-supply-cards">{visible.map(o => { const entitled = (state.memberships.mode === '年会员' && state.memberships.active) || state.memberships.unlocked.includes(o.plotId); return <article key={o.plotId}><div><Tag>{o.crop}</Tag><Tag tone="gray">农户供货意向</Tag></div><h2>{o.town}</h2><p>{o.area} 亩 · 预计成熟 {o.harvest}</p><div className="portal-offer-value"><strong>{o.quantity.toLocaleString()}<small> kg</small></strong><span>预计可供量</span></div>{entitled ? <p>意向价：<strong>¥{money(o.price)} / kg</strong><br/><small>联络入口待接入，不展示真实个人电话。</small></p> : <div className="portal-locked"><ShieldCheck size={17}/><span>查看价格与联络权益</span>{state.memberships.mode === '按条查看' ? <button className="secondary-button" onClick={() => commit('buyer', { type: 'unlock', plotId: o.plotId })}>模拟解锁 ¥9.9</button> : <Link to={rolePath('buyer', 'membership')}>选择查看方案</Link>}</div>}<Link to={rolePath('buyer', 'demands')} className="portal-enter">发布对应采购需求 <ArrowUpRight size={16}/></Link></article> })}{!visible.length && <div className="farm-empty">暂时没有匹配的公开货源</div>}</div></Panel><Panel title="成熟期分布" caption="只统计当前筛选结果，不是实收预测模型"><div className="portal-timeline">{[...visible].sort((a, b) => a.harvest.localeCompare(b.harvest)).map(o => <div key={o.plotId}><time>{o.harvest}</time><strong>{o.crop}</strong><span>{o.quantity.toLocaleString()} kg · {o.town}</span></div>)}</div><p className="farm-hint">用于安排采购计划，不能替代现场验货与双方合同。</p></Panel></div></div>
}

function Demands({ role }: { role: Role }) {
  const { state, commit } = usePortal(); const [open, setOpen] = useState(false)
  const [product, setProduct] = useState('阳光玫瑰葡萄'); const [grade, setGrade] = useState(role.id === 'processor' ? 'B级' : 'A级'); const [quantity, setQuantity] = useState(1000); const [date, setDate] = useState('2026-09-02'); const [note, setNote] = useState('')
  const rows = state.demands.filter(d => d.actor === role.id)
  return <div className="farm-page"><Heading title="采购需求" description="发布整批采购或尾货补货需求；全部以kg记账，1kg=2斤。需求不是已成交订单。" action={<button className="primary-button" onClick={() => setOpen(true)}><Plus size={16}/>发布采购需求</button>}/><Panel title="本主体需求" caption="需求同时出现在生产方供货页面，便于协同回应"><Table headers={['产品 / 等级', '需求量', '到货时间', '说明', '状态', '操作']} empty={!rows.length}>{rows.map(d => <tr key={d.id}><td>{d.product}<small>{d.grade} · {d.id}</small></td><td>{d.quantity.toLocaleString()} kg<small>{(d.quantity * 2).toLocaleString()}斤</small></td><td>{d.date}</td><td>{d.note || '—'}</td><td><Tag tone={d.status === '征集中' ? 'amber' : 'gray'}>{d.status}</Tag></td><td>{d.status === '征集中' && <button className="secondary-button" onClick={() => commit(role.id, { type: 'closeDemand', id: d.id })}>关闭需求</button>}</td></tr>)}</Table></Panel><p className="farm-hint">共享库存预订在“库存与订单”中操作。正式版报价、合同、验货、支付与税务仍需另行开发。</p>
    {open && <DialogForm title="发布采购需求" close={() => setOpen(false)} submit={() => commit(role.id, { type: 'demand', demand: { id: uid('DEMAND'), product, grade, quantity, date, note } })}><label>产品<input required value={product} onChange={e => setProduct(e.target.value)}/></label><label>等级<select value={grade} onChange={e => setGrade(e.target.value)}>{['A级', 'B级', 'C级', '不限'].map(g => <option key={g}>{g}</option>)}</select></label><label>需求数量 / kg<input type="number" required min="0.01" step="0.01" value={quantity} onChange={e => setQuantity(Number(e.target.value))}/></label><label>预计到货日期<input type="date" required value={date} onChange={e => setDate(e.target.value)}/></label><label>验收与补货说明<textarea value={note} onChange={e => setNote(e.target.value)}/></label></DialogForm>}
  </div>
}

function Stock({ role }: { role: Role }) {
  const { state: farm } = useFarm(); const { state, farmCommit } = usePortal()
  const batches = scopedBatches(farm, role.id); const [selected, setSelected] = useState(''); const [quantity, setQuantity] = useState(100)
  const batch = batches.find(b => b.id === selected)
  const processed = (id: string) => state.processing.filter(e => e.batchId === id).reduce((s, e) => s + e.input, 0)
  const free = (id: string) => Math.max(0, available(batches.find(b => b.id === id)!) - processed(id))
  const orders = farm.orders.filter(o => role.id === 'buyer' ? o.buyer === role.actor : batches.some(b => b.id === o.batchId))
  return <div className="farm-page"><Heading title="库存与订单" description={role.id === 'warehouse' ? '只管理本库保管批次。出库需货主与交易双方授权，演示按钮仅测试库存流转。' : '可用量扣除已售、已锁定和已登记分拣量。预订仅为演示，不发生扣款。'}/><Panel title={role.id === 'buyer' ? '公开共享库存' : '关联库存批次'} caption="示例批次日期以2026-08-29为基准；正式端必须校验真实有效期与品质"><Table headers={['产品 / 批次', '货权主体 / 库位', '账面 / 可用', '锁定 / 分拣登记', '有效期', ...(role.id === 'warehouse' ? [] : ['意向价']), '操作']} empty={!batches.length}>{batches.map(b => <tr key={b.id}><td>{b.product} · {b.grade}<small>{b.id}</small></td><td>{b.owner}<small>{b.storage}</small></td><td>{b.quantity - b.sold} / {free(b.id)} kg</td><td>{b.reserved} / {processed(b.id)} kg</td><td>{b.expires}</td>{role.id !== 'warehouse' && <td>¥{money(b.price)} / kg</td>}<td>{role.id === 'buyer' ? <button className="secondary-button" disabled={free(b.id) <= 0} onClick={() => { setSelected(b.id); setQuantity(Math.min(100, free(b.id))) }}>预订库存</button> : <Tag tone="gray">{role.id === 'warehouse' ? '保管台账' : '货权台账'}</Tag>}</td></tr>)}</Table></Panel><Panel title={role.id === 'buyer' ? '我的库存订单' : '批次交接订单'} caption="锁定量防止重复出售；取消释放锁定量；演示出库转为已售量"><Table headers={['订单 / 批次', '采购主体', '数量', '状态', '操作']} empty={!orders.length}>{orders.map(o => <tr key={o.id}><td>{o.id}<small>{o.batchId}</small></td><td>{o.buyer}</td><td>{o.quantity} kg</td><td><Tag tone={o.status === '已锁定' ? 'amber' : 'gray'}>{o.status}</Tag></td><td>{o.status === '已锁定' && role.id === 'buyer' && <button className="secondary-button" onClick={() => farmCommit(role.id, { type: 'orderStatus', id: o.id, status: '已取消' })}>取消预订</button>}{o.status === '已锁定' && role.id === 'warehouse' && <button className="secondary-button" onClick={() => farmCommit(role.id, { type: 'orderStatus', id: o.id, status: '已出库' })}>模拟授权出库</button>}</td></tr>)}</Table></Panel>
    {batch && <DialogForm title="预订共享库存" close={() => setSelected('')} submit={() => farmCommit(role.id, { type: 'reserve', order: { id: uid('ORDER'), batchId: batch.id, buyer: role.actor, quantity, price: batch.price } })}><p>{batch.product} · {batch.grade} · 可用 {free(batch.id)} kg</p><label>预订数量 / kg<input type="number" required min="0.01" step="0.01" max={free(batch.id)} value={quantity} onChange={e => setQuantity(Number(e.target.value))}/></label><p>意向金额：¥{money(quantity * batch.price)}（未付款）</p></DialogForm>}
  </div>
}

function Membership() {
  const { state, commit } = usePortal()
  return <div className="farm-page"><Heading title="会员与查看" description="向采购商提供数据查看服务；不向生产端农户收费。具体价格可配置，此处仅演示。"/><div className="portal-plan-grid">{(['年会员', '按条查看'] as const).map(mode => <article className="panel portal-plan" key={mode}><Tag tone={state.memberships.mode === mode ? 'green' : 'gray'}>{state.memberships.mode === mode ? '当前方案' : '可选方案'}</Tag><h2>{mode}</h2><div className="portal-plan-price">¥{mode === '年会员' ? '699' : '9.9'}<small> / {mode === '年会员' ? '年 · 示例' : '条 · 示例'}</small></div><p>{mode === '年会员' ? '查看公开货源的意向价格与联络权益。年费规划控制在999元以内。' : '按条获取公开货源详情，适合偶发采购。当前模拟解锁，不收费。'}</p><button className="secondary-button" disabled={state.memberships.mode === mode} onClick={() => commit('buyer', { type: 'membership', mode })}>选择{mode}（不付款）</button></article>)}</div><Panel title="权益状态" caption="切换方案不会自动购买或开通年会员"><p>{state.memberships.active ? '初始化示例年会员已开通，不代表真实付款。' : '未真实开通；年会员需正式支付与服务端校验，按条可在货源页模拟解锁。'}</p><p>累计模拟解锁：{state.memberships.unlocked.length}条</p><Link to={rolePath('buyer', 'maturity')}>前往成熟货源 →</Link></Panel></div>
}

function Nfc({ role, receiptsOnly = false }: { role: Role; receiptsOnly?: boolean }) {
  const { state: farm } = useFarm(); const { state, commit } = usePortal()
  const [cardId, setCardId] = useState('XQ-C0001'); const [identified, setIdentified] = useState(''); const [error, setError] = useState('')
  const [product, setProduct] = useState('有机肥（示例）'); const [batch, setBatch] = useState('DEMO-20260829'); const [quantity, setQuantity] = useState(2); const [unit, setUnit] = useState('袋'); const [amount, setAmount] = useState(160); const [consent, setConsent] = useState(false)
  const card = farm.cards.find(c => c.id === identified && c.status === '已激活')
  function identify() { const found = farm.cards.find(c => c.id === cardId.trim() && c.status === '已激活'); setIdentified(found?.id || ''); setError(found ? '' : '未找到可用演示卡，或卡片已挂失。'); setConsent(false) }
  return <div className="farm-page"><Heading title={receiptsOnly ? '农资销售凭据' : 'NFC销售登记'} description="刷卡只获取本次登记所需的身份；购买凭据与实际施用分开记录，不读取完整农户档案。"/>{!receiptsOnly && <div className="portal-overview-grid"><Panel title="01 / 模拟刷卡识别" caption="未接入真实NFC读卡器；使用样卡编号XQ-C0001测试"><div className="portal-nfc-mark"><Radio size={42}/><span>农资销售端</span></div><div className="farm-form"><label>演示卡片编号<input value={cardId} onChange={e => { setCardId(e.target.value); setIdentified(''); setConsent(false) }}/></label><button className="secondary-button" onClick={identify}>模拟NFC识别</button>{error && <p className="farm-warning" role="alert">{error}</p>}{card && <div className="portal-boundary-note"><CheckCircle2 size={20}/><span>本次交易对象：{card.farmer}<br/><small>{card.id} · 未开放其他生产档案</small></span></div>}</div></Panel><Panel title="02 / 登记购买凭据" caption="保留商品、批次、数量与金额，关联到农户购买记录"><form className="farm-form" onSubmit={e => { e.preventDefault(); if (card && commit(role.id, { type: 'sale', consent, sale: { id: uid('SALE'), cardId: card.id, customer: card.farmer, product, batch, quantity, unit, amount, at: now() } })) { setIdentified(''); setConsent(false) } }}><label>商品名称<input required value={product} onChange={e => setProduct(e.target.value)}/></label><label>商品批次<input required value={batch} onChange={e => setBatch(e.target.value)}/></label><div className="farm-form-grid"><label>数量<input type="number" required min="0.01" step="0.01" value={quantity} onChange={e => setQuantity(Number(e.target.value))}/></label><label>单位<select value={unit} onChange={e => setUnit(e.target.value)}>{['袋', '瓶', 'kg', 'L', '件'].map(u => <option key={u}>{u}</option>)}</select></label></div><label>实际金额 / 元<input type="number" required min="0.01" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))}/></label><label className="farm-checkbox"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)}/>已获得农户对本次交易身份关联的确认</label><button className="primary-button" disabled={!card || !consent}>保存销售凭据</button></form></Panel></div>}
    <Panel title="本门店销售台账" caption="当前只含本门店的演示凭据；本页面不展示其他门店交易"><Table headers={['凭据 / 时间', '农户', '商品 / 批次', '数量', '金额', '记录性质']} empty={!state.sales.length}>{state.sales.map(s => <tr key={s.id}><td>{s.id}<small>{s.at}</small></td><td>{s.customer}</td><td>{s.product}<small>{s.batch}</small></td><td>{s.quantity} {s.unit}</td><td>¥{money(s.amount)}</td><td><Tag tone="gray">购买，不代表施用</Tag></td></tr>)}</Table></Panel></div>
}

function Assets({ role }: { role: Role }) {
  const { state, commit } = usePortal()
  return <div className="farm-page"><Heading title="服务资源" description="同一套资源架构，按农机、人员队伍、植保设备区分类型；这里是人工维护状态，不是实时遥测。"/><div className="portal-plot-grid">{state.assets.filter(a => a.role === role.id).map(a => <article className="panel portal-asset" key={a.id}><Tag tone="gray">{role.name}自有资源</Tag><h2>{a.name}</h2><p>{a.id}</p><label>服务状态<select aria-label={`${a.name}服务状态`} value={a.status} onChange={e => commit(role.id, { type: 'asset', id: a.id, status: e.target.value as '可预约' | '作业中' | '维护中' })}>{['可预约', '作业中', '维护中'].map(v => <option key={v}>{v}</option>)}</select></label><small>更新资源状态不会自动替代订单执行与验收。</small></article>)}</div><Panel title="服务团队共用的履约流程"><div className="portal-flow">{['接单', '排期', '作业', '提交凭据', '委托方验收'].map((t, i) => <div key={t}><span>0{i + 1}</span><strong>{t}</strong><small>{i === 3 && role.id === 'protection' ? '增加植保专用档案' : '通用服务模块'}</small></div>)}</div></Panel></div>
}

function Protection({ role }: { role: Role }) {
  const { state, commit } = usePortal(); const [open, setOpen] = useState(false)
  const jobs = scopedJobs(state, role.id).filter(j => j.status === '作业中')
  const [jobId, setJobId] = useState(jobs[0]?.id || ''); const [product, setProduct] = useState(''); const [batch, setBatch] = useState(''); const [amount, setAmount] = useState(1); const [unit, setUnit] = useState('L'); const [area, setArea] = useState(1); const [days, setDays] = useState(''); const [note, setNote] = useState(''); const [confirmed, setConfirmed] = useState(false)
  return <div className="farm-page"><Heading title="植保作业档案" description="共用服务订单，但独立保存药剂、批次、用量、面积和标签安全间隔。系统不自动推荐药剂或剂量。" action={<button className="primary-button" disabled={!jobs.length} onClick={() => { setJobId(jobs[0]?.id || ''); setOpen(true) }}><Plus size={16}/>登记植保作业</button>}/><div className="farm-warning">请先在“农事服务”开始作业，再补齐植保档案。安全间隔、适用作物与用量由专业人员依据登记标签和现场条件核对；填写0天并不表示任何药剂无需间隔。</div><Panel title="本团队施用记录" caption="档案完成不代表食品安全认证；作业仍由委托方确认"><Table headers={['作业订单', '药剂 / 批次', '施用总量', '作业面积', '标签安全间隔', '现场说明']} empty={!state.protection.length}>{state.protection.map(p => <tr key={p.id}><td>{p.jobId}<small>{p.at}</small></td><td>{p.product}<small>{p.batch}</small></td><td>{p.amount} {p.unit}</td><td>{p.area} 亩</td><td>{p.safetyDays} 天</td><td>{p.note}</td></tr>)}</Table></Panel>
    {open && <DialogForm title="登记植保作业" close={() => setOpen(false)} submit={() => commit(role.id, { type: 'protection', confirmed, entry: { id: uid('SPRAY'), jobId, product, batch, amount, unit, area, safetyDays: Number(days), note, at: now() } })}><label>本团队正在执行的订单<select required value={jobId} onChange={e => setJobId(e.target.value)}>{jobs.map(j => <option key={j.id} value={j.id}>{j.id} · {j.operation}</option>)}</select></label><label>药剂名称（按标签）<input required value={product} onChange={e => setProduct(e.target.value)}/></label><label>药剂生产批次<input required value={batch} onChange={e => setBatch(e.target.value)}/></label><div className="farm-form-grid"><label>实际施用总量<input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))}/></label><label>用量单位<select value={unit} onChange={e => setUnit(e.target.value)}>{['L', 'mL', 'kg', 'g'].map(u => <option key={u}>{u}</option>)}</select></label><label>实际作业面积 / 亩<input required type="number" min="0.01" step="0.01" max={jobs.find(j => j.id === jobId)?.area} value={area} onChange={e => setArea(Number(e.target.value))}/></label><label>标签安全间隔 / 天<input required type="number" min="0" max="365" step="1" value={days} onChange={e => setDays(e.target.value)}/></label></div><label>核对与现场说明<textarea required minLength={5} value={note} onChange={e => setNote(e.target.value)}/></label><label className="farm-checkbox"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>已由专业人员核对标签、适用作物与作业方案</label></DialogForm>}
  </div>
}

function Processing({ role }: { role: Role }) {
  const { state: farm } = useFarm(); const { state, commit } = usePortal(); const [open, setOpen] = useState(false)
  const batches = scopedBatches(farm, role.id); const [batchId, setBatchId] = useState(batches[0]?.id || '')
  const [input, setInput] = useState(500); const [a, setA] = useState(0); const [b, setB] = useState(450); const [c, setC] = useState(30); const [loss, setLoss] = useState(20)
  return <div className="farm-page"><Heading title="分拣批次" description="投入量必须等于A级、B级、C级和损耗之和。这里只登记分拣，产出未验收前不重复生成可售库存。" action={<button className="primary-button" disabled={!batches.length} onClick={() => setOpen(true)}><Plus size={16}/>登记分拣</button>}/><Panel title="本车间分级记录" caption="不消耗已锁定库存；重复登记累计量不能超过未锁定剩余量"><Table headers={['批次', '投入量', 'A级', 'B级', 'C级', '损耗', '账目校验']} empty={!state.processing.length}>{state.processing.map(p => <tr key={p.id}><td>{p.batchId}<small>{p.at}</small></td><td>{p.input} kg</td><td>{p.a} kg</td><td>{p.b} kg</td><td>{p.c} kg</td><td>{p.loss} kg</td><td><Tag>投入产出平衡</Tag></td></tr>)}</Table></Panel><Panel title="B级补货与尾货共享"><p>生产方与加工主体可以发布补货意向。先验证当地交易频次，再决定是否增加合同、支付和履约能力。</p><Link to={rolePath(role.id, 'demands')}>发布尾货补货需求 →</Link></Panel>
    {open && <DialogForm title="登记分拣投入与产出" close={() => setOpen(false)} submit={() => commit(role.id, { type: 'process', entry: { id: uid('SORT'), batchId, input, a, b, c, loss, at: now() } })}><label>本车间货权批次<select value={batchId} onChange={e => setBatchId(e.target.value)}>{batches.map(b => <option key={b.id} value={b.id}>{b.id} · {b.product}</option>)}</select></label><div className="farm-form-grid">{([{ label: '投入量 / kg', value: input, change: setInput }, { label: 'A级产出 / kg', value: a, change: setA }, { label: 'B级产出 / kg', value: b, change: setB }, { label: 'C级产出 / kg', value: c, change: setC }, { label: '损耗 / kg', value: loss, change: setLoss }]).map(v => <label key={v.label}>{v.label}<input type="number" required min={v.label.startsWith('投入') ? 0.01 : 0} step="0.01" value={v.value} onChange={e => v.change(Number(e.target.value))}/></label>)}</div><p>产出合计：{(a + b + c + loss).toFixed(2)} kg / 投入：{input} kg</p></DialogForm>}
  </div>
}

function Soil({ role }: { role: Role }) {
  const { state: farm } = useFarm(); const { state } = usePortal(); const plots = scopedPlots(farm, state, role.id)
  const rows = farm.soils.filter(s => plots.some(p => p.id === s.plotId))
  const pending = state.samples.filter(s => plots.some(p => p.id === s.plotId))
  return <div className="farm-page"><Heading title="肥力与建议" description="土壤结果与机构建议分开保存；演示文本不作为实际施肥处方。"/><div className="portal-plot-grid">{rows.map(s => <article className="panel portal-soil" key={s.id}><Tag tone={s.status === '已归档' ? 'green' : 'amber'}>{s.status}</Tag><h2>{plots.find(p => p.id === s.plotId)?.name}</h2><p>{s.institution} · {s.sampleDate}</p><div className="portal-soil-values"><div><strong>{s.ph}</strong><small>pH</small></div><div><strong>{s.organic}</strong><small>有机质 / g·kg⁻¹</small></div></div><p>{s.advice}</p><small>报告编号：{s.reportNo}</small></article>)}</div><Panel title="本地检测委托进度" caption="新报告只在演示委托中提交，尚未进入正式认证或报送系统"><Table headers={['样品', '地块', '状态', '报告编号']} empty={!pending.length}>{pending.map(s => <tr key={s.id}><td>{s.id}</td><td>{s.plotId}</td><td><Tag tone="amber">{s.status}</Tag></td><td>{s.reportNo || '待提交'}</td></tr>)}</Table></Panel></div>
}

function Lab({ role, reportsOnly = false }: { role: Role; reportsOnly?: boolean }) {
  const { state, commit } = usePortal(); const [selected, setSelected] = useState('')
  const [ph, setPh] = useState(6.2); const [organic, setOrganic] = useState(24.5); const [advice, setAdvice] = useState('请结合目标产量与既有施肥记录，由农技人员现场复核。'); const [reportNo, setReportNo] = useState(''); const [evidence, setEvidence] = useState('')
  const rows = reportsOnly ? state.samples.filter(s => s.status === '待运营核验') : state.samples
  return <div className="farm-page"><Heading title={reportsOnly ? '检测报告' : '受托样品'} description="只处理委托给本机构的样品。提交结果不等于通过乡桥记录核验，更不等于绿色食品认证。"/><Panel title={reportsOnly ? '已提交待核验报告' : '本机构委托列表'} caption="采样 → 已采样 → 提交报告 → 运营核验；当前只演示前三步"><Table headers={['样品 / 地块', '委托方', '状态', '结果 / 报告', '操作']} empty={!rows.length}>{rows.map(s => <tr key={s.id}><td>{s.id}<small>{s.plotId} · {s.date}</small></td><td>{s.customer}</td><td><Tag tone="amber">{s.status}</Tag></td><td>{s.reportNo || '尚未提交'}{s.ph !== undefined && <small>pH {s.ph} · 有机质 {s.organic} g/kg<br/>{s.advice}<br/>{s.evidence}（未上传）</small>}</td><td>{s.status === '待采样' && <button className="secondary-button" onClick={() => commit(role.id, { type: 'sample', id: s.id })}>标记采样完成</button>}{s.status === '已采样' && <button className="primary-button" onClick={() => { setSelected(s.id); setReportNo(`DEMO-${s.id}`); setEvidence('') }}>提交检测报告</button>}</td></tr>)}</Table></Panel>
    {selected && <DialogForm title="提交检测报告" close={() => setSelected('')} submit={() => commit(role.id, { type: 'report', id: selected, ph, organic, advice, reportNo, evidence })}><label>机构报告编号<input required value={reportNo} onChange={e => setReportNo(e.target.value)}/></label><div className="farm-form-grid"><label>pH<input type="number" required min="0" max="14" step="0.01" value={ph} onChange={e => setPh(Number(e.target.value))}/></label><label>有机质 / g·kg⁻¹<input type="number" required min="0" max="1000" step="0.01" value={organic} onChange={e => setOrganic(Number(e.target.value))}/></label></div><label>机构建议<textarea required minLength={5} value={advice} onChange={e => setAdvice(e.target.value)}/></label><label>报告PDF（≤10MB，只保存文件名）<input type="file" accept="application/pdf,.pdf" required onChange={e => { const f = e.target.files?.[0]; setEvidence(f && f.size > 0 && f.size <= 10 * 1024 * 1024 && f.name.toLowerCase().endsWith('.pdf') ? f.name.toLowerCase() : '') }}/></label></DialogForm>}
  </div>
}

function Authorization({ role }: { role: Role }) {
  const { state, commit } = usePortal(); const [permissions, setPermissions] = useState(state.family)
  return <div className="farm-page"><Heading title="家庭授权" description="林春梅 → 林晓。正式授权须本人身份验证与留痕，本原型不把切换演示角色视为真实授权。"/><Panel title={role.id === 'farmer' ? '由本人决定子女可以做什么' : '查看我的代办权限'} caption="子女不能自行提权；关闭查看会同时撤销卡片代办与记录整理"><form className="farm-form" onSubmit={e => { e.preventDefault(); commit(role.id, { type: 'family', permissions }) }}>{([{ key: 'view', label: '查看农事记录与绑定卡片' }, { key: 'configure', label: '代办A/B/C设置与蓝牙同步' }, { key: 'stories', label: '整理nong.cloud产季记录草稿' }] as const).map(p => <label className="portal-permission" key={p.key}><span><ShieldCheck size={20}/>{p.label}</span><input type="checkbox" aria-label={p.label} disabled={role.id !== 'farmer' || (p.key !== 'view' && !permissions.view)} checked={role.id === 'farmer' ? permissions[p.key] : state.family[p.key]} onChange={e => setPermissions(previous => p.key === 'view' && !e.target.checked ? { view: false, configure: false, stories: false } : { ...previous, [p.key]: e.target.checked })}/></label>)}{role.id === 'farmer' && <button className="primary-button">保存家庭授权</button>}</form></Panel><p className="farm-hint">正式端应支持授权期限、委托凭据、撤销与审计。记录草稿不等于公开发布，公开前另行确认照片、位置和隐私。</p></div>
}

function Stories({ role }: { role: Role }) {
  const { state, commit } = usePortal(); const [text, setText] = useState('')
  if (!state.family.stories) return <Panel title="尚未授权整理记录"><p>请由种植户本人开放“产季记录草稿”权限。您不能自行开通。</p><Link to={rolePath(role.id, 'authorization')}>查看授权范围 →</Link></Panel>
  return <div className="farm-page"><Heading title="产季记录草稿" description="用真实记录讲生产过程，供后续nong.cloud展示与消费者认购。这里只保存草稿，不收费、不自动发布。"/><Panel title="记录这一季的田间记录" caption="不要把一次购买或一条作业记录写成无农残、有机、绿色食品等质量承诺"><form className="farm-form" onSubmit={e => { e.preventDefault(); if (commit(role.id, { type: 'story', text, id: uid('STORY'), at: now() })) setText('') }}><label>记录内容<textarea required minLength={10} maxLength={2000} rows={6} value={text} onChange={e => setText(e.target.value)} placeholder="例如：这周家里完成了葡萄园修剪，实际作业记录仍在核验中。"/></label><button className="primary-button">保存记录草稿</button></form></Panel><Panel title="待家人确认的草稿"><div className="portal-story-list">{state.stories.map(s => <article key={s.id}><Tag tone="gray">未公开</Tag><p>{s.text}</p><small>{s.at}</small></article>)}{!state.stories.length && <p>还没有记录草稿。</p>}</div></Panel></div>
}

function Operations() {
  const { state: farm } = useFarm(); const batches = scopedBatches(farm, 'warehouse')
  return <div className="farm-page"><Heading title="冷库运营" description="运营状态、温度、电力要分别采集。电量只能辅助判断设备活动，不能证明有货、货量或质量。"/><Stats items={[{ label: '保管批次', value: batches.length, detail: '来自本库库存台账' }, { label: '电力采集设备', value: '未接入', detail: '需场所授权及合规安装' }, { label: '温度监测', value: '暂无实测', detail: '不展示虚构实时温度' }, { label: '运营推断', value: '不可判断', detail: '缺少原始遥测及人工复核' }]}/><Panel title="遥测接入规划" caption="此模块是接口占位，不是已部署的监控"><Table headers={['数据类型', '接入方式规划', '用途', '当前状态']}><tr><td>分回路用电</td><td>授权电表 / 网关</td><td>辅助识别设备活动</td><td><Tag tone="gray">未接入</Tag></td></tr><tr><td>库内温湿度</td><td>传感器 / 网关</td><td>异常提醒与储存条件记录</td><td><Tag tone="gray">未接入</Tag></td></tr><tr><td>库存进出</td><td>货主单据 / 交接确认</td><td>保管台账、批次追溯</td><td><Tag>本地演示</Tag></td></tr></Table></Panel></div>
}

export function RolePage({ role, module }: { role: Role; module: ModuleId }) {
  const { state } = usePortal()
  if (role.id === 'family' && !state.family.view && module !== 'authorization') return <Panel title="家庭授权已撤销"><p>当前不能查看生产记录或执行代办。请由种植户本人重新授权。</p><Link to={rolePath(role.id, 'authorization')}>查看授权状态 →</Link></Panel>
  if (module.startsWith('value-') && isValueView(module.slice(6))) return <RoleValuePage role={role} view={module.slice(6) as ValueView}/>
  switch (module) {
    case 'plots': return <Plots role={role}/>
    case 'records': return <><Records role={role}/><ServiceEvidence role={role}/></>
    case 'cards': return <Cards role={role}/>
    case 'costs': return <Costs role={role}/>
    case 'services': return <><Services role={role}/><ServiceEvidence role={role}/></>
    case 'sales': return <Offers role={role}/>
    case 'maturity': return <Maturity/>
    case 'demands': return <Demands role={role}/>
    case 'stock': return <Stock role={role}/>
    case 'membership': return <Membership/>
    case 'nfc': return <Nfc role={role}/>
    case 'receipts': return <Nfc role={role} receiptsOnly/>
    case 'assets': return <Assets role={role}/>
    case 'protection': return <Protection role={role}/>
    case 'processing': return <Processing role={role}/>
    case 'soil': return <Soil role={role}/>
    case 'samples': return <Lab role={role}/>
    case 'reports': return <Lab role={role} reportsOnly/>
    case 'authorization': return <Authorization role={role}/>
    case 'stories': return <Stories role={role}/>
    case 'operations': return <Operations/>
  }
}
