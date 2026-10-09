import { CalendarDays, FileImage, FileVideo, FlaskConical, Plus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useFarm } from './FarmProvider'
import { costEstimate, money, uid } from './model'
import type { CostInput, CropChange, Evidence, ProductionPlot, SoilReport } from './model'
import { FarmPage, Modal, Panel, PlotSelect, SearchField, Stats, Table, Tag, useSearchRows } from './ui'

export function ProductionPage() {
  const { state } = useFarm()
  const [params, setParams] = useSearchParams()
  const { query, setQuery, visible } = useSearchRows(state.plots)
  const [changePlot, setChangePlot] = useState<ProductionPlot | null>(null)
  const [forecastPlot, setForecastPlot] = useState<ProductionPlot | null>(null)
  const [review, setReview] = useState<CropChange | null>(null)
  const selectedId = params.get('plot')
  const rows = visible.filter(p => !selectedId || p.id === selectedId)
  return <FarmPage title="地块生产档案" description="连通多年种植、产季、成熟预测和土壤建议；种植变更须照片、视频及审核留痕">
    <Stats items={[{ label: '示例地块', value: state.plots.length, detail: '与原有地块核验页面并存' }, { label: '示例覆盖面积', value: `${state.plots.reduce((s, p) => s + p.area, 0).toFixed(1)} 亩`, detail: '首年500亩为目标，不是现有实绩' }, { label: '预测总产量', value: `${(state.plots.filter(p => !p.forecastPending).reduce((s, p) => s + p.yieldKg, 0) / 1000).toFixed(1)} 吨`, detail: '剔除种植变更后待重新估算项' }, { label: '待审核变更', value: state.changes.filter(c => c.status === '待审核').length, detail: '审核通过前不改写当前作物' }]}/>
    <Panel title="产季档案" caption="本轮为示例档案；小程序测绘、实际边界与海拔采集待接入" action={<Link className="secondary-button" to="/plots">原有地块核验 →</Link>}><div className="farm-toolbar"><SearchField value={query} onChange={setQuery} placeholder="搜索地块、农户或品种"/>{selectedId && <button className="secondary-button" onClick={() => setParams({})}>显示全部示例档案</button>}</div>
      <div className="farm-production-grid">{rows.map(p => <article className="farm-plot-card" key={p.id}><div className="farm-plot-top"><span className="farm-plot-icon"><CalendarDays size={24}/></span><Tag tone="gray">{p.season} · v{p.version}</Tag></div><h3>{p.name}</h3><p>{p.town} · {p.owner}</p><div className="farm-crop">{p.crop}</div><div className="farm-plot-metrics"><span><small>面积</small><strong>{p.area}亩</strong></span><span><small>海拔 / 示例</small><strong>{p.altitude}m</strong></span><span><small>预计成熟</small><strong>{p.forecastPending ? '待重估' : p.harvest.slice(5)}</strong></span></div><div className="farm-mini-history"><strong>多年种植 / 旧版本</strong>{p.archive.map((a, i) => <p key={`${a.year}-${i}`}><span>{a.year} · {a.crop}</span><span>{a.yieldKg.toLocaleString()}kg</span></p>)}</div><div className="farm-actions"><button className="farm-link" onClick={() => setChangePlot(p)}>申请种植变更</button><button className="farm-link" onClick={() => setForecastPlot(p)}>成熟与产量设置</button><Link className="farm-link" to={`/records?plot=${p.id}`}>农事记录 →</Link><Link className="farm-link" to={`/soil?plot=${p.id}`}>土壤档案 →</Link>{p.id.startsWith('PL') && <Link className="farm-link" to={`/plots/${p.id}`}>基础核验 →</Link>}</div></article>)}</div>{!rows.length && <div className="farm-empty">该原有地块尚未建立本轮示例产季档案。<button className="farm-link" onClick={() => setParams({})}>查看示例地块</button></div>}
    </Panel>
    <Panel title="种植信息变更审核" caption="模拟附件只保存文件名称与类型，不上传内容，不能代替现场真实性审核"><Table headers={['申请 / 时间', '地块', '新作物', '证据材料', '状态', '操作']} empty={!state.changes.length}>{state.changes.map(c => <tr key={c.id}><td><strong>{c.id}</strong><small>{c.at}</small></td><td>{state.plots.find(p => p.id === c.plotId)?.name}<small>基于v{c.baseVersion}</small></td><td>{c.crop}</td><td>{c.evidence.filter(e => e.kind === 'image').length}照片 / {c.evidence.filter(e => e.kind === 'video').length}视频</td><td><Tag tone={c.status === '待审核' ? 'amber' : c.status === '已通过' ? 'green' : 'red'}>{c.status}</Tag></td><td><button className="farm-link" onClick={() => setReview(c)}>查看申请</button></td></tr>)}</Table></Panel>
    {changePlot && <CropChangeForm plot={changePlot} onClose={() => setChangePlot(null)}/>}{review && <ChangeReview change={state.changes.find(c => c.id === review.id)!} onClose={() => setReview(null)}/>}
    {forecastPlot && <ForecastForm plot={forecastPlot} onClose={() => setForecastPlot(null)}/>}
  </FarmPage>
}

function ForecastForm({ plot, onClose }: { plot: ProductionPlot; onClose: () => void }) {
  const { commit } = useFarm()
  const [harvest, setHarvest] = useState(plot.harvest)
  const [yieldKg, setYieldKg] = useState(plot.yieldKg)
  const [availableKg, setAvailableKg] = useState(plot.availableKg)
  const [error, setError] = useState('')
  return <Modal title={`${plot.name} · 成熟与产量预测`} onClose={onClose}><form className="farm-form" onSubmit={e => { e.preventDefault(); if (commit({ type: 'forecast', plotId: plot.id, harvest, yieldKg, availableKg })) onClose(); else setError('预测未保存，请检查日期、供应量与待审种植变更') }}><div className="farm-note">种植产品变更后必须重新核实预测。意向供应为获农户授权的估计量，不是仓库实存或交付承诺。</div><label>预计成熟日期<input type="date" required value={harvest} onChange={e => setHarvest(e.target.value)}/></label><label>预测总产量（kg）<input type="number" min="0.001" step="0.001" required value={yieldKg} onChange={e => setYieldKg(Number(e.target.value))}/></label><label>授权意向供应（kg）<input type="number" min={0} max={yieldKg} step="0.001" required value={availableKg} onChange={e => setAvailableKg(Number(e.target.value))}/></label>{error && <p role="alert" className="farm-warning">{error}</p>}<button className="primary-inline">保存演示预测</button></form></Modal>
}

function CropChangeForm({ plot, onClose }: { plot: ProductionPlot; onClose: () => void }) {
  const { commit } = useFarm()
  const [crop, setCrop] = useState('')
  const [reason, setReason] = useState('')
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [error, setError] = useState('')
  return <Modal title={`${plot.name} · 种植变更`} onClose={onClose}><form className="farm-form" onSubmit={e => { e.preventDefault(); if (reason.trim().length < 5) return setError('变更原因至少5个字'); if (!evidence.some(f => f.kind === 'image') || !evidence.some(f => f.kind === 'video')) return setError('必须同时选择照片和视频'); if (commit({ type: 'cropChange', change: { id: uid('CHANGE'), plotId: plot.id, crop, reason, evidence } })) onClose(); else setError('申请未保存，请检查材料或是否已有待审申请') }}>
    <div className="farm-note">当前：{plot.crop} / v{plot.version}。审核通过前不修改现有档案。</div><label>变更后的种植产品<input value={crop} onChange={e => setCrop(e.target.value)} required maxLength={50} placeholder="输入新品种或产品名称"/></label><label>变更原因<textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} required maxLength={500}/></label>
    <label className="farm-upload">照片和视频（两类都必需）<input aria-label="照片和视频（两类都必需）" type="file" accept="image/*,video/*" multiple onChange={e => { const files = Array.from(e.target.files || []); if (files.some(f => !f.type.startsWith('image/') && !f.type.startsWith('video/'))) { setEvidence([]); return setError('仅支持图片和视频') } if (files.some(f => f.size === 0 || f.size > (f.type.startsWith('video/') ? 100 : 10) * 1024 * 1024)) { setEvidence([]); return setError('文件不能为空，照片≤10MB，视频≤100MB') } setEvidence(files.map(f => ({ name: f.name, kind: f.type.startsWith('video/') ? 'video' : 'image', size: f.size }))); setError('') }}/><small>本轮仅保存附件元数据，不上传照片/视频；刷新后仍可查看文件清单。</small></label><div className="farm-evidence">{evidence.map((f, i) => <p key={i}>{f.kind === 'image' ? <FileImage size={16}/> : <FileVideo size={16}/>} {f.name}</p>)}</div>
    {error && <p className="farm-warning" role="alert">{error}</p>}<button className="primary-inline">提交变更申请</button>
  </form></Modal>
}
function ChangeReview({ change, onClose }: { change: CropChange; onClose: () => void }) {
  const { commit } = useFarm()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  function decide(approve: boolean) { if (reason.trim().length < 5) return setError('审核说明至少5个字'); if (commit({ type: 'reviewChange', id: change.id, approve, reason })) onClose() }
  return <Modal title={`${change.id} · 变更审核`} onClose={onClose}><div className="farm-form"><div className="farm-note">仅演示审核状态流转：材料没有上传内容，本轮不能执行真实认证。正式系统要求不同角色提交与审核。</div><div className="farm-detail-list"><div><span>新作物</span><strong>{change.crop}</strong></div><div><span>原因</span><strong>{change.reason}</strong></div><div><span>附件清单</span><strong>{change.evidence.map(f => f.name).join('、')}</strong></div><div><span>当前状态</span><strong>{change.status}</strong></div></div>{change.status === '待审核' ? <><label>审核说明<textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={500}/></label>{error && <p className="farm-warning" role="alert">{error}</p>}<div className="farm-modal-actions"><button className="secondary-button" onClick={() => decide(false)}>模拟驳回</button><button className="primary-inline" onClick={() => decide(true)}>模拟通过 / 留档</button></div></> : <p>{change.reviewReason}</p>}</div></Modal>
}

export function SoilPage() {
  const { state, commit } = useFarm()
  const [params, setParams] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<SoilReport | null>(null)
  const rows = state.soils.filter(s => !params.get('plot') || s.plotId === params.get('plot'))
  return <FarmPage title="土壤肥力与机构建议" description="按地块关联采样报告、机构建议和归档记录，为施肥决策提供依据" action={<button className="primary-inline" onClick={() => setAdding(true)}><Plus size={16}/>登记检测报告</button>}>
    <Stats items={[{ label: '示例报告', value: state.soils.length, detail: '保留采样日期和机构来源' }, { label: '已归档', value: state.soils.filter(s => s.status === '已归档').length, detail: '内部核验后的报告记录' }, { label: '待核验', value: state.soils.filter(s => s.status === '待核验').length, detail: '核验编号、样点和机构资质' }, { label: '肥力指标', value: 'pH / 有机质', detail: '其他指标待机构数据接口接入' }]}/>
    <Panel title="检测档案" caption="土壤检测不能替代农残、食品安全检测，建议不作为示例之外的实际施肥处方" action={params.get('plot') && <button className="farm-link" onClick={() => setParams({})}>显示全部</button>}><Table headers={['报告编号 / 机构', '关联地块', '采样日期', 'pH', '有机质', '状态', '操作']} empty={!rows.length}>{rows.map(s => <tr key={s.id}><td><strong>{s.reportNo}</strong><small>{s.institution}</small></td><td>{state.plots.find(p => p.id === s.plotId)?.name}</td><td>{s.sampleDate}</td><td>{s.ph}</td><td>{s.organic} g/kg</td><td><Tag tone={s.status === '已归档' ? 'green' : 'amber'}>{s.status}</Tag></td><td><button className="farm-link" onClick={() => setSelected(s)}>查看报告</button></td></tr>)}</Table></Panel>
    {adding && <SoilForm initialPlot={params.get('plot') || state.plots[0].id} onClose={() => setAdding(false)}/>}
    {selected && <Modal title={`${selected.reportNo} · 机构建议`} onClose={() => setSelected(null)}><div className="farm-form"><FlaskConical size={28}/><h3>{state.plots.find(p => p.id === selected.plotId)?.name}</h3><p>{selected.advice}</p><p className="farm-note">此处显示演示录入文本，没有检测报告原件。正式归档需核验报告文件、采样链和授权。</p><Link className="farm-link" to={`/records?plot=${selected.plotId}`} onClick={() => setSelected(null)}>查看施肥等农事记录 →</Link>{selected.status === '待核验' && <button className="primary-inline" onClick={() => { if (commit({ type: 'archiveSoil', id: selected.id })) setSelected(null) }}><ShieldCheck size={16}/>模拟核验归档</button>}</div></Modal>}
  </FarmPage>
}
function SoilForm({ initialPlot, onClose }: { initialPlot: string; onClose: () => void }) {
  const { commit } = useFarm()
  const [plotId, setPlotId] = useState(initialPlot)
  const [institution, setInstitution] = useState('')
  const [reportNo, setReportNo] = useState('')
  const [sampleDate, setSampleDate] = useState('2026-08-29')
  const [ph, setPh] = useState(6)
  const [organic, setOrganic] = useState(20)
  const [advice, setAdvice] = useState('')
  const [error, setError] = useState('')
  return <Modal title="登记土壤检测报告" onClose={onClose}><form className="farm-form" onSubmit={e => { e.preventDefault(); if (commit({ type: 'soil', report: { id: uid('SOIL'), plotId, institution, reportNo, sampleDate, ph, organic, advice, status: '待核验' } })) onClose(); else setError('登记未保存，请检查编号是否重复及必填项') }}><PlotSelect value={plotId} onChange={setPlotId}/><label>检测机构<input required value={institution} onChange={e => setInstitution(e.target.value)} maxLength={80}/></label><label>报告编号<input required value={reportNo} onChange={e => setReportNo(e.target.value)} maxLength={60}/></label><label>采样日期<input required type="date" value={sampleDate} onChange={e => setSampleDate(e.target.value)}/></label><div className="farm-form-grid"><label>pH<input type="number" min={0} max={14} step="0.1" required value={ph} onChange={e => setPh(Number(e.target.value))}/></label><label>有机质（g/kg）<input type="number" min={0} step="0.1" required value={organic} onChange={e => setOrganic(Number(e.target.value))}/></label></div><label>机构建议<textarea required rows={3} value={advice} onChange={e => setAdvice(e.target.value)} maxLength={1000}/></label>{error && <p role="alert" className="farm-warning">{error}</p>}<button className="primary-inline">登记为待核验</button></form></Modal>
}

const costFields: { key: keyof CostInput; label: string; unit: string }[] = [{ key: 'days', label: '家庭劳动折算工日', unit: '天' }, { key: 'dayRate', label: '当地参考日工价', unit: '元/天' }, { key: 'inputs', label: '农资投入合计', unit: '元' }, { key: 'services', label: '农机与农服成本', unit: '元' }, { key: 'other', label: '其他成本与分摊', unit: '元' }, { key: 'yieldKg', label: '可售净产量', unit: 'kg' }, { key: 'markup', label: '成本加价率', unit: '%' }]
export function CostPage() {
  const { state, commit } = useFarm()
  const [input, setInput] = useState<CostInput>(() => ({ ...state.cost }))
  let result: ReturnType<typeof costEstimate> | null = null
  try { result = costEstimate(input) } catch { /* incomplete form is shown below */ }
  return <FarmPage title="种植成本估算" description="按工日、农资与服务成本测算自主定价参考，成本资料默认不向收购商公开">
    <div className="farm-two-col farm-cost-layout"><Panel title="授权示例 · 葡萄产季测算" caption="工日及农资可从记录汇总；当前手动输入，当地行情接口未接入"><form className="farm-form farm-body" onSubmit={e => { e.preventDefault(); commit({ type: 'cost', input }) }}><div className="farm-form-grid">{costFields.map(f => <label key={f.key}>{f.label}<span className="farm-input-unit"><input aria-label={f.label} type="number" min={f.key === 'yieldKg' ? 0.001 : 0} max={f.key === 'markup' ? 100 : 100000000} step="any" required value={input[f.key]} onChange={e => setInput(current => ({ ...current, [f.key]: Number(e.target.value) }))}/><span>{f.unit}</span></span></label>)}</div><p className="farm-note">本例工日按家庭劳动机会成本折算；雇工现金支出应归入服务成本，避免重复计入。其他项含租地、折旧、损耗等分摊。行情与产量均需核实。</p><div className="farm-actions"><button className="primary-inline" disabled={!result}>保存测算</button><button className="secondary-button" type="button" onClick={() => setInput({ ...state.cost })}>恢复已保存值</button></div></form></Panel>
      <Panel title="自主定价参考" caption="成本 × (1 + 加价率)；35%为加价率，不是毛利率"><div className="farm-body">{result ? <><div className="farm-price-result"><span>完全成本 + {input.markup}% 加价</span><strong>¥{money(result.referencePrice)}<small>/kg</small></strong><p>约 ¥{money(result.referencePrice / 2)} / 斤 · 仅供农户定价参考</p></div><div className="farm-detail-list"><div><span>家庭劳动折算</span><strong>¥{money(result.labour)}</strong></div><div><span>非家庭劳动成本小计</span><strong>¥{money(result.cash)}</strong></div><div><span>完全成本</span><strong>¥{money(result.full)}</strong></div><div><span>非家庭劳动成本 / kg</span><strong>¥{money(result.cashPerKg)}</strong></div><div><span>完全成本 / kg</span><strong>¥{money(result.fullPerKg)}</strong></div></div><h3>产量敏感性</h3><div className="farm-sensitivity">{[0.8, 1, 1.2].map(scale => <div key={scale}><small>{scale === 1 ? '基准产量' : scale < 1 ? '产量减少20%' : '产量增加20%'}</small><strong>¥{money(result!.referencePrice / scale)} / kg</strong></div>)}</div><p className="farm-note">并非保底收购承诺，不自动写入采购单。定价还需考虑品质、市场、合同与实际损耗。</p></> : <p className="farm-warning" role="alert">成本应为非负数，可售净产量须大于0，加价率为0–100%。</p>}</div></Panel></div>
  </FarmPage>
}
