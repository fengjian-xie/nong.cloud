import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, Sprout } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useFarm } from '../farm/FarmProvider'
import type { FarmState, ProductionPlot } from '../farm/model'
import { demoDate } from '../farm/model'
import { Panel, Stats, Table, Tag } from '../farm/ui'
import { usePortal } from '../portals/PortalProvider'
import { publicOffers, scopedPlots } from '../portals/model'
import type { Role } from '../portals/config'
import { makeActor } from '../system/model'
import { downloadText } from '../home/download'
import { ContentDialog } from '../components/ContentDialog'
import { generateStory, gradeMatches, incomeEstimate, isValueView, publicSummary, reduceValue, reminders, restoreValue, seedIncome, valueKey, valueViews, verifiedEvents, type IncomeInput, type ValueActor, type ValueCommand, type ValueState, type ValueView } from './model'
import { PassportSummary, PublicPassport } from './PassportSummary'
import './value.css'

function useValueDemo(actor: ValueActor, farm: FarmState) {
  const key = valueKey(actor.accountId)
  const [state, setState] = useState(() => {
    try { return restoreValue(localStorage.getItem(key), actor.accountId, farm) }
    catch { return restoreValue(null, actor.accountId, farm) }
  })
  const current = useRef(state), [notice, setNotice] = useState(''), [error, setError] = useState('')
  function act(command: ValueCommand) {
    try {
      const next = reduceValue(current.current, command, actor, farm, new Date().toISOString(), crypto.randomUUID?.() || `value-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      current.current = next; setState(next); setError('')
      let message = '已保存当前账号的本机演示；未发送给他人、未锁库、未形成真实合同或付款。'
      if (command.type === 'passport.approve') message = '独立审核演示通过。只更新本机状态，不向nong.cloud、农场、小程序或第三方发布。'
      if (command.type === 'story') message = '记录已保存为待本人确认草稿，不自动公开；核验记录不是产品安全或认证证明。'
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { message += '储存不可用，刷新后本次更改可能丢失。' }
      setNotice(message); return true
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); setNotice(''); return false }
  }
  return { state, act, notice, error }
}

export function RoleValuePage({ role, view }: { role: Role; view: ValueView }) {
  const { state: farm } = useFarm(), { state, accountId } = usePortal()
  const plots = scopedPlots(farm, state, role.id)
  const publicIds = publicOffers(farm, state).map(p => p.plotId)
  const processedKg = state.processing.reduce<Record<string, number>>((totals, e) => ({ ...totals, [e.batchId]: (totals[e.batchId] || 0) + e.input }), {})
  const actor: ValueActor = { accountId, role: role.id, plotIds: plots.map(p => p.id), publicPlotIds: publicIds, processedKg, canReview: false, canStory: role.id !== 'family' || (state.family.view && state.family.stories) }
  return <ValueWorkspace key={`${accountId}:${role.id}:${view}`} view={view} farm={farm} actor={actor} publicIds={publicIds} managed/>
}

export default function AdminValuePage({ viewId, managed = false }: { viewId?: ValueView; managed?: boolean } = {}) {
  const { view: routeView } = useParams(), { session } = useAuth(), { state: farm } = useFarm()
  const view = viewId || routeView
  if (!session || !isValueView(view)) return <Panel title="没有这个产品价值模块"><Link to="/production/value/passport">返回产品履历</Link></Panel>
  const admin = makeActor(session.user)
  if (!admin.permissions.includes('records.read')) return <Panel title="当前岗位无生产记录查看权限"><p>请由获授权的运营岗位处理。</p></Panel>
  const actor: ValueActor = { accountId: session.user.id, role: 'admin', plotIds: farm.plots.map(p => p.id), canReview: admin.permissions.includes('records.review'), canStory: admin.permissions.includes('records.review') }
  return <ValueWorkspace key={`${session.user.id}:${view}`} view={view} farm={farm} actor={actor} publicIds={[]} managed={managed}/>
}

function ValueWorkspace({ actor, farm, view, publicIds, managed = false }: { actor: ValueActor; farm: FarmState; view: ValueView; publicIds: string[]; managed?: boolean }) {
  const demo = useValueDemo(actor, farm)
  const ownPlots = farm.plots.filter(p => actor.plotIds.includes(p.id))
  const [plotId, setPlotId] = useState(ownPlots[0]?.id || '')
  const plot = ownPlots.find(p => p.id === plotId)
  const base = actor.role === 'admin' ? '/production/value/' : `/workspace/${actor.role}/value-`
  const visibleViews = actor.role === 'admin' ? Object.keys(valueViews) : roleValueViews(actor.role)
  return <div className="farm-page value-page">
    <div className="page-heading"><div><div className="farm-eyebrow">乡桥 / 记录到产品价值</div><h1><Sprout size={25}/>{valueViews[view]}</h1><p>把认真劳作留下的依据，连接到批次、供货、经营和反馈。</p></div><Tag tone="gray">本机交互原型</Tag></div>
    <div className="farm-demo">所有数据为示例。记录不等于质量认证；预测不等于现货，意向不等于成交。农户平台服务费0，办卡/补卡各100元。</div>
    {!managed ? <nav className="value-nav" aria-label="产品价值模块">{visibleViews.map(v => <Link key={v} aria-current={view === v ? 'page' : undefined} to={`${base}${v}`}>{valueViews[v as ValueView]}</Link>)}</nav> : null}
    {demo.notice ? <p className="farm-feedback" role="status">{demo.notice}</p> : null}{demo.error ? <p className="farm-warning" role="alert">{demo.error}</p> : null}
    {ownPlots.length && ['passport', 'stories', 'income', 'history', 'calendar'].includes(view) ? <label className="value-select">授权地块<select value={plotId} onChange={e => setPlotId(e.target.value)}>{ownPlots.map(p => <option value={p.id} key={p.id}>{p.name} · {p.season}</option>)}</select></label> : null}
    {view === 'passport' ? plot ? <PassportPanel key={plot.id} farm={farm} plot={plot} actor={actor} {...demo}/> : <PublicPassport/> : null}
    {view === 'calendar' ? <SupplyCalendar key={plot?.id || 'public'} farm={farm} plot={plot} actor={actor} publicIds={publicIds} {...demo}/> : null}
    {view === 'stories' ? plot && actor.canStory ? <StoryPanel key={plot.id} farm={farm} plot={plot} {...demo}/> : <Panel title="尚无产季记录整理授权"><p>子女须获得额外授权，不因可查看记录就自动获得公开权限。</p><Link to={`/workspace/${actor.role}/authorization`}>查看家庭授权 →</Link></Panel> : null}
    {view === 'income' ? plot ? <IncomePanel key={plot.id} plot={plot} {...demo}/> : <Panel title="当前身份无经营账访问权限"><p>经营账不对采购与消费身份开放。</p></Panel> : null}
    {view === 'grades' ? <GradePanel farm={farm} actor={actor} {...demo}/> : null}
    {view === 'history' ? plot ? <HistoryPanel plot={plot}/> : <Panel title="当前身份无跨年经营档案权限"><p>请选择获授权的生产身份。</p></Panel> : null}
    {view === 'collaboration' ? <CollaborationPanel farm={farm} actor={actor} {...demo}/> : null}
    {view === 'feedback' ? <FeedbackPanel actor={actor} {...demo}/> : null}
    <details className="value-footnote"><summary>本机流程留痕（不是服务器审计）</summary>{demo.state.audit.filter(a => a.role === actor.role).slice(0, 8).map((a, i) => <p key={i}>{a.at} · {a.action} · {a.target}</p>)}</details>
    <p className="value-footnote">网页、小程序和公开农场尚未接统一后端。本机保存不跨端共享；不会发出通知、生成检测结论或替农户接受报价。</p>
  </div>
}

type Demo = { state: ValueState; act: (command: ValueCommand) => boolean }
function roleValueViews(role: string): ValueView[] {
  if (['farmer', 'cooperative'].includes(role)) return ['passport', 'calendar', 'stories', 'income', 'grades', 'history', 'collaboration', 'feedback']
  if (role === 'family') return ['passport', 'stories', 'history']
  if (['buyer', 'processor'].includes(role)) return ['passport', 'calendar', 'grades', 'feedback']
  if (role === 'warehouse') return ['passport', 'grades']
  if (['machine', 'team', 'protection', 'lab', 'supplier'].includes(role)) return ['collaboration']
  return []
}


function PassportPanel({ farm, plot, actor, state, act }: { farm: FarmState; plot: ProductionPlot; actor: ValueActor } & Demo) {
  const passport = state.passports.find(p => p.plotId === plot.id)!
  const [note, setNote] = useState(passport.note), [consent, setConsent] = useState(passport.consent), [preview, setPreview] = useState(false)
  const writable = actor.canReview || ['farmer', 'cooperative'].includes(actor.role)
  const summary = publicSummary(farm, passport)
  return <><Stats items={[{ label: '批次履历版本', value: `v${passport.version}`, detail: `关联地块版本 v${plot.version}` }, { label: '可引用核验事件', value: verifiedEvents(farm, plot).length, detail: '只选同步、归属一致且已核验记录' }, { label: '公开状态', value: passport.status, detail: '不把记录完整度解释为品质分数' }]}/>
    <Panel title="一批产品，一份履历" caption="批次必须与实物核对；混装另建混合批，不套用其他户的记录" action={<button className="secondary-button" onClick={() => setPreview(true)}>预览公开摘要</button>}><form className="farm-form" onSubmit={e => { e.preventDefault(); act({ type: 'passport.save', plotId: plot.id, note, consent }) }}><label>批次对应与缺项说明<textarea required value={note} minLength={8} maxLength={500} disabled={!writable} onChange={e => setNote(e.target.value)}/></label><label className="value-check"><input type="checkbox" checked={consent} disabled={!writable} onChange={e => setConsent(e.target.checked)}/>已核对本次摘要公开范围（仅演示，不是真实授权凭据）</label><div className="value-actions"><button className="primary-button" disabled={!writable || !['草稿', '已撤回'].includes(passport.status)}>保存履历草稿</button><button type="button" className="secondary-button" disabled={!writable || !passport.consent || !['草稿', '已撤回'].includes(passport.status)} onClick={() => act({ type: 'passport.submit', plotId: plot.id })}>提交独立审核</button><button type="button" className="secondary-button" disabled={!actor.canReview || passport.status !== '待独立审核' || passport.contributors.includes(actor.accountId)} onClick={() => act({ type: 'passport.approve', plotId: plot.id })}>独立审核演示</button><button type="button" className="secondary-button" disabled={!writable || ['草稿', '已撤回'].includes(passport.status)} onClick={() => act({ type: 'passport.withdraw', plotId: plot.id })}>撤回履历</button></div></form><p className="farm-hint">同一账号编辑过的履历不能自审。跨账号审核队列、正式发布、批次二维码和纠错回执待后端；预览与导出不是已发布。</p></Panel>
    {actor.canReview ? <Panel title="独立审核流程演练" caption="载入其他示例编辑的待审核稿，不覆盖本人编辑，不是真实授权或发布"><button className="secondary-button" disabled={passport.status !== '草稿' || passport.contributors.includes(actor.accountId)} onClick={() => act({ type: 'review.example', plotId: plot.id })}>载入其他编辑的审核示例</button></Panel> : null}
    <Panel title="授权摘要资料包" caption="可供后续采购说明或机构协作；不自动产生贷款、补贴、担保或保险资格"><button className="secondary-button" disabled={!passport.consent} onClick={() => downloadText('乡桥产品公开摘要-演示.json', JSON.stringify(summary, null, 2))}>导出最小摘要示例</button><p className="farm-hint">仅导出上述字段，无GPS、卡号、私人成本或完整档案。机构资料要求另行核验。</p></Panel>
    {preview ? <ContentDialog title="产品公开摘要预览" onClose={() => setPreview(false)}><PassportSummary summary={summary}/></ContentDialog> : null}</>
}

function SupplyCalendar({ farm, plot, actor, publicIds, state, act }: { farm: FarmState; plot?: ProductionPlot; actor: ValueActor; publicIds: string[] } & Demo) {
  const [product, setProduct] = useState(''), [month, setMonth] = useState('全部'), [start, setStart] = useState(plot?.harvest || ''), [end, setEnd] = useState(plot?.harvest || ''), [min, setMin] = useState('0'), [max, setMax] = useState(String(plot?.availableKg || 0)), [source, setSource] = useState('种植方预测，需采前人工复核（示例）')
  const privateMode = actor.canReview || ['farmer', 'cooperative'].includes(actor.role)
  const plots = farm.plots.filter(p => (privateMode ? actor.plotIds : publicIds).includes(p.id) && p.crop.includes(product) && (month === '全部' || p.harvest.slice(5, 7) === month))
  return <><Panel title="成熟窗口，而不是现货承诺" caption={`演示数据基准日 ${demoDate}；供货量与日期须采前确认`}><div className="value-filters"><label>筛选产品<input value={product} onChange={e => setProduct(e.target.value)} placeholder="葡萄 / 品种"/></label><label>成熟月份<select value={month} onChange={e => setMonth(e.target.value)}><option>全部</option>{Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => <option key={m}>{m}</option>)}</select></label></div><div className="value-calendar">{plots.map(p => { const w = privateMode ? state.windows.find(w => w.plotId === p.id && w.version === p.version) : undefined; return <article key={p.id}><CalendarDays size={23}/><Tag tone="amber">{p.forecastPending ? '变更后待复核' : '预计窗口'}</Tag><h3>{p.crop}</h3><p>福建·福安 / {p.season}</p><strong>{w ? `${w.start} 至 ${w.end}` : `${p.harvest}附近（尚未确认）`}</strong><p>{w ? `${w.minKg}–${w.maxKg} kg` : `0–${p.availableKg} kg（示例预测上限）`}</p><small>{w?.source || '种植方供货摘要（示例），非实收库存'}</small>{w?.updatedAt ? <small>本地更新：{w.updatedAt}</small> : null}<button className="secondary-button" disabled={p.forecastPending} onClick={() => act({ type: 'subscribe', plotId: p.id })}>{state.subscriptions.includes(p.id) ? '取消本机关注' : '关注成熟窗口'}</button>{!privateMode ? <LocalNote kind="询价" target={p.id} label={`询价说明：${p.crop}`} act={act}/> : null}</article> })}</div>{!plots.length ? <p className="farm-empty">暂无符合条件的授权供货摘要。</p> : null}</Panel>
    {plot && privateMode ? <Panel key={plot.id} title="调整本地预测窗口" caption="保存预测草案，不更改已有供货意向或真实订单"><form className="farm-form" onSubmit={e => { e.preventDefault(); act({ type: 'window', draft: { plotId: plot.id, start, end, minKg: Number(min), maxKg: Number(max), source, version: plot.version } }) }}><div className="farm-form-grid"><label>预计开始<input type="date" required value={start} onChange={e => setStart(e.target.value)}/></label><label>预计结束<input type="date" required value={end} onChange={e => setEnd(e.target.value)}/></label><label>可供量下限 / kg<input type="number" min="0" required value={min} onChange={e => setMin(e.target.value)}/></label><label>可供量上限 / kg<input type="number" min="0" required value={max} onChange={e => setMax(e.target.value)}/></label></div><label>来源与更新说明<textarea required value={source} minLength={8} onChange={e => setSource(e.target.value)}/></label><button className="primary-button">保存预测草案</button></form></Panel> : null}
    <Panel title="我的关注与询价草稿"><p>{state.subscriptions.length}个本机关注；尚无实际通知推送。</p><Followups state={state} role={actor.role} kinds={['询价']}/></Panel></>
}

function StoryPanel({ farm, plot, state, act }: { farm: FarmState; plot: ProductionPlot } & Demo) {
  const [text, setText] = useState(''), [evidenceIds, setEvidenceIds] = useState<string[]>([]), [consent, setConsent] = useState(false), [error, setError] = useState('')
  function generate() { try { const generated = generateStory(farm, plot.id); setText(generated.text); setEvidenceIds(generated.evidenceIds); setError('') } catch (e) { setError((e as Error).message) } }
  return <><Panel title="从核验依据整理产季记录" caption="确定性记录摘要，不调用AI、不编造农户发言，不自动公开"><button className="secondary-button" onClick={generate}>整理本季记录摘要</button>{error ? <p className="farm-warning" role="alert">{error}</p> : null}<form className="farm-form" onSubmit={e => { e.preventDefault(); if (act({ type: 'story', plotId: plot.id, text, evidenceIds, mediaConfirmed: consent })) { setText(''); setEvidenceIds([]); setConsent(false) } }}><label>产季说明与备注<textarea rows={7} required minLength={10} maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="先生成有来源摘要，再人工核对；无真实照片时不虚构配图。"/></label><label className="value-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>已核对文案依据与媒体授权，仍待本人确认公开</label><button className="primary-button">保存待本人确认草稿</button></form><p className="farm-hint">关联{evidenceIds.length}条核验事件。不能据此承诺无农残、绿色或有机；代办授权不自动包含公开权。</p></Panel><Panel title="本地产季记录草稿"><div className="value-stories">{state.stories.filter(s => s.plotId === plot.id).map(s => <article key={s.id}><Tag tone="amber">{s.status}</Tag><p>{s.text}</p><small>{s.at} · {s.evidenceIds.length}条来源</small></article>)}</div></Panel></>
}

const incomeLabels: Record<keyof IncomeInput, string> = { revenue: '销售收入 / 元', materials: '实际施用农资成本 / 元', services: '农服农机成本 / 元', other: '其他生产成本 / 元', packaging: '包装 / 元', coldChain: '冷链仓储 / 元', delivery: '配送 / 元', afterSale: '售后损耗费用 / 元', card: '农事卡分摊 / 元', laborDays: '确认出工 / 人天', dayRate: '本地参考日工资 / 元', quantityKg: '对应产品数量 / kg' }
function IncomePanel({ plot, state, act }: { plot: ProductionPlot } & Demo) {
  const [input, setInput] = useState<IncomeInput>(state.income[plot.id] || { ...seedIncome }), [result, setResult] = useState<ReturnType<typeof incomeEstimate> | null>(null), [error, setError] = useState('')
  return <><Panel title="销售方案经营账" caption="默认只计100元卡片分摊示例，其余待输入；不是自动记账或已确认利润"><form className="farm-form" onSubmit={e => { e.preventDefault(); try { const result = incomeEstimate(input); if (act({ type: 'income', plotId: plot.id, input })) { setResult(result); setError('') } } catch (e) { setResult(null); setError((e as Error).message) } }}><div className="farm-form-grid">{Object.entries(incomeLabels).map(([k, label]) => <label key={k}>{label}<input type="number" required min="0" step="0.01" value={input[k as keyof IncomeInput]} onChange={e => { setInput({ ...input, [k]: e.target.value }); setResult(null) }}/></label>)}</div><button className="primary-button">保存并测算净收益</button></form>{error ? <p role="alert" className="farm-warning">{error}</p> : null}<p className="farm-hint">方案测算，不是会计利润。现金成本与家庭劳动分开；包装、配送等不要再重复计入“其他”。已损失产品不计入实售数量，费用不要重复扣减。购买不等于施用，按键不是人天。</p></Panel>{result ? <Stats items={[{ label: '现金净收益测算', value: `¥${result.cashNet.toFixed(2)}`, detail: '收入减实际支出，含卡片分摊' }, { label: '含劳动净收益测算', value: `¥${result.fullNet.toFixed(2)}`, detail: '再扣家庭劳动估值，可为负数' }, { label: '完整成本 / kg', value: `¥${result.unit.toFixed(2)}`, detail: '对应产量口径，不当作已售均价' }, { label: '参考加价 ×1.35', value: `¥${result.reference.toFixed(2)}`, detail: '自主议价参考，不强制收购或保证利润' }]}/> : null}<Panel title="农户决定卖给谁、何时卖"><p>经营账只在授权生产身份下显示，不向采购商或消费者公开底价。行情来源、缺项和实际交付还需确认。</p></Panel></>
}

function GradePanel({ farm, actor, state, act }: { farm: FarmState; actor: ValueActor } & Demo) {
  const [product, setProduct] = useState('葡萄'), [grade, setGrade] = useState('B级'), [quantity, setQuantity] = useState('2000'), [unit, setUnit] = useState('斤'), [result, setResult] = useState<ReturnType<typeof gradeMatches> | null>(null), [error, setError] = useState('')
  const canDemand = ['buyer', 'processor', 'cooperative', 'admin'].includes(actor.role)
  return <><Panel title="先分级，再匹配用途" caption={`共享库存示例基准日${demoDate}，不是今天可交易的实物库存`}><form className="farm-form" onSubmit={e => { e.preventDefault(); try { setResult(gradeMatches(farm, product, grade, quantity, unit, actor.processedKg)); setError('') } catch (e) { setResult(null); setError((e as Error).message) } }}><div className="farm-form-grid"><label>产品关键词<input value={product} required onChange={e => { setProduct(e.target.value); setResult(null) }}/></label><label>产品等级<select value={grade} onChange={e => { setGrade(e.target.value); setResult(null) }}>{['A级', 'B级', 'C级'].map(g => <option key={g}>{g}</option>)}</select></label><label>需求数量<input required min="0.01" step="0.01" type="number" value={quantity} onChange={e => { setQuantity(e.target.value); setResult(null) }}/></label><label>数量单位<select value={unit} onChange={e => { setUnit(e.target.value); setResult(null) }}><option>斤</option><option>kg</option></select></label></div><button className="primary-button">匹配共享货源示例</button></form>{error ? <p className="farm-warning" role="alert">{error}</p> : null}<p className="farm-hint">B级是分级，不等于不合格；异常货隔离，不推荐用于食品加工。本模块不锁库、不增加库存，具体质量与货权须验收。</p></Panel>{result ? <Panel title={`匹配 ${result.rows.length} 批 · 需求 ${result.kg} kg`}><Table headers={['批次 / 产品', '等级', '示例可用量', '示例时效', '边界']} empty={!result.rows.length}>{result.rows.map(b => <tr key={b.batchId}><td>{b.batchId}<small>{b.product}</small></td><td>{b.grade}</td><td>{b.availableKg} kg</td><td>{b.expires}</td><td>{b.scope}</td></tr>)}</Table>{canDemand ? <LocalNote kind="分级需求" target={`${grade}:${result.kg}kg:${product}`} label="用途、需要时间与质量要求" act={act}/> : null}</Panel> : null}<Panel title="补货意向草稿"><Followups state={state} role={actor.role} kinds={['分级需求']}/></Panel></>
}

function HistoryPanel({ plot }: { plot: ProductionPlot }) {
  return <><Panel title="跨年地块产季对比" caption="只展示现有历史产量示例；缺失成本和品质项不补造"><Table headers={['产季', '作物', '产量 / kg', '口径', '成本 / 品质']}><tr><td>{plot.season}</td><td>{plot.crop}</td><td>{plot.yieldKg}</td><td>本季预测，不是实收</td><td>暂无经核验的年度成本与品质</td></tr>{plot.archive.map((a, i) => <tr key={i}><td>{a.year}</td><td>{a.crop}</td><td>{a.yieldKg}</td><td>档案示例，待实收凭据确认</td><td>缺项，不计算“质量提升率”</td></tr>)}</Table><p className="farm-hint">年份之间天气、品种、面积和渠道可能不同，不能把产量变化归因于农事卡。只读档案不因填入本季测算而覆盖历史证据。</p></Panel><Panel title="先留事实，再形成经验"><p>后续追加实际称重、销售、检测与行情的版本化来源，才能比较亩产、损耗和净收益。未核验数据不参与自动农技处方。</p></Panel></>
}

function CollaborationPanel({ farm, actor, state, act }: { farm: FarmState; actor: ValueActor } & Demo) {
  const rows = reminders(farm, actor.plotIds)
  return <><Panel title="缺项提醒与人工跟进" caption="提示依据和责任，不自动判定作业正确或问题已解决"><div className="value-calendar">{rows.map(r => <article key={r.id}><Tag tone="amber">待核实</Tag><h3>{r.title}</h3><p>{r.detail}</p><small>{r.plotId}</small><LocalNote kind="跟进" target={r.id} label={`跟进说明：${r.id}`} act={act}/></article>)}</div>{!rows.length ? <p>当前没有可查看的地块提醒；服务队仅处理本主体受托任务，不开放农户全部档案。</p> : null}</Panel><Panel title="产区协同与队伍能力"><p>修剪、套袋、采收是服务能力标签；葡萄、茶叶等特色身份复用流程模板。排班需核对委托、资质、可用时间，仍由独立人员验收。</p><Link to={actor.role === 'admin' ? '/services' : `/workspace/${actor.role}/services`}>进入现有农事服务 →</Link><p className="farm-hint">不自动向服务商派单，不生成施药建议，跟进登记不等于完工。</p></Panel><Panel title="跟进登记"><Followups state={state} role={actor.role} kinds={['跟进']}/></Panel></>
}
function FeedbackPanel({ actor, state, act }: { actor: ValueActor } & Demo) {
  return <><Panel title="把履约反馈带回生产端" caption="先登记真实订单的关联线索；本版没有真实订单验证，不公开评分或投诉"><LocalNote kind="反馈" target="产品批次与履约反馈草稿" label="批次、交付情况与问题说明（仅测试）" act={act}/><p className="farm-hint">反馈不自动退款、不改农事记录、不降低农户信誉。正式端需关联订单、独立受理、双方证据和隐私授权。</p><Link to={actor.role === 'admin' ? '/services/help-center' : `/workspace/${actor.role}/help`}>需要帮助？进入帮助中心 →</Link></Panel><Panel title="本账号反馈草稿"><Followups state={state} role={actor.role} kinds={['反馈']}/></Panel></>
}
function LocalNote({ kind, target, label, act }: { kind: '询价' | '分级需求' | '跟进' | '反馈'; target: string; label: string; act: Demo['act'] }) {
  const [text, setText] = useState('')
  return <form className="value-note" onSubmit={e => { e.preventDefault(); if (act({ type: 'followup', kind, target, text })) setText('') }}><label>{label}<textarea required minLength={8} maxLength={600} value={text} onChange={e => setText(e.target.value)} placeholder="测试说明，不填真实私人资料"/></label><button className="secondary-button">保存{kind}草稿</button></form>
}
function Followups({ state, kinds, role }: { state: ValueState; kinds: string[]; role: string }) {
  const rows = state.followups.filter(f => kinds.includes(f.kind) && f.role === role)
  return <div className="value-stories">{rows.map(f => <article key={f.id}><Tag tone="gray">本地{f.kind} · 未发送</Tag><strong>{f.target}</strong><p>{f.text}</p><small>{f.at}</small></article>)}{!rows.length ? <p className="farm-hint">暂无本机草稿。</p> : null}</div>
}
