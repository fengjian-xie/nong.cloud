import { Check, ChevronRight, Filter, Plus, RefreshCw, Search, Star, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { decide, deleteModuleRow, getModuleRows, saveModuleRow } from '../api/mock'
import { PaginationBar } from '../components/PaginationBar'
import { StatusChip } from '../components/StatusChip'
import type { OperationRow } from '../types'

const meta = {
  members: { title: '会员与主体', description: '管理多重身份、任务完成度及系统/客户双评分', primary: '审核', action: 'approve', columns: [['name', '姓名/主体'], ['identities', '多重身份'], ['taskCompletion', '任务完成度'], ['systemRating', '系统评分'], ['customerRating', '客户评分'], ['status', '状态']] },
  plots: { title: '地块核验', description: '维护所在地、面积、定位、海拔与采集来源', primary: '核验通过', action: 'verify', columns: [['town', '所在地'], ['name', '地块'], ['owner', '所有者'], ['area', '面积'], ['altitude', '海拔'], ['collectionMethod', '采集方式'], ['status', '状态']] },
  services: { title: '服务市场', description: '管理公开需求、接单状态与标准验收', primary: '发布到市场', action: 'dispatch', columns: [['service', '服务'], ['grower', '需求方'], ['provider', '服务方'], ['status', '状态'], ['deadline', '时限']] },
  supply: { title: '供需审核', description: '审核存量或运营代录的供应信息', primary: '审核上架', action: 'approve', columns: [['title', '供应信息'], ['owner', '发布主体'], ['source', '数据来源'], ['status', '状态'], ['validUntil', '有效至']] },
  config: { title: '参数配置', description: '管理字段模板版本与发布留痕', primary: '发布版本', action: 'publish', columns: [['name', '模板'], ['version', '版本'], ['status', '状态'], ['publisher', '发布人']] },
  audit: { title: '审计与提权', description: '执行双人审批并查询关键操作', primary: '批准提权', action: 'approve', columns: [['applicant', '申请人'], ['permission', '申请权限'], ['reason', '理由'], ['status', '状态']] },
} as const

const memberLabels: Record<string, string> = {
  id: '编号', name: '姓名/主体', identities: '多重身份', type: '主体类型', town: '所在乡镇',
  assignedTasks: '应完成任务', completedTasks: '已完成任务', overdueTasks: '逾期任务', canceledTasks: '取消任务',
  taskCompletion: '任务完成度', systemRating: '系统评分', customerRating: '客户评分', status: '状态', updatedAt: '更新时间',
}
const deadlineDate = (value: unknown) => { const text = String(value); if (text.startsWith('今天')) return '2026-08-29'; if (text.startsWith('明天')) return '2026-08-30'; const match = text.match(/(\d{2})-(\d{2})/); return match ? `2026-${match[1]}-${match[2]}` : '' }

function MultiFilter({ label, values, selected, open, onOpen, onToggle, onClear }: { label: string; values: string[]; selected: string[]; open: boolean; onOpen: () => void; onToggle: (value: string) => void; onClear: () => void }) {
  return <div className={`multi-filter${open ? ' open' : ''}`}><button type="button" className="multi-filter-trigger" aria-haspopup="true" aria-expanded={open} onClick={onOpen}>{label}{selected.length ? `（${selected.length}）` : '：全部'}</button>{open ? <div className="multi-filter-panel town-filter-panel" role="group" aria-label={`${label}多选`}>{values.map((value) => <label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} /><span>{value}</span></label>)}<div className="multi-filter-actions"><button type="button" onClick={onClear}>清空</button><button type="button" onClick={onOpen}>完成</button></div></div> : null}</div>
}

export function OperationsPage({ module }: { module: keyof typeof meta }) {
  const config = meta[module]
  const [rows, setRows] = useState<OperationRow[]>([])
  const [query, setQuery] = useState('')
  const [serviceFilters, setServiceFilters] = useState<string[]>([])
  const [providerFilters, setProviderFilters] = useState<string[]>([])
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [deadlineFrom, setDeadlineFrom] = useState('')
  const [deadlineTo, setDeadlineTo] = useState('')
  const [deadlineCustom, setDeadlineCustom] = useState(false)
  const [filterOpen, setFilterOpen] = useState<'service' | 'provider' | 'status' | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<OperationRow | null>(null)
  const [editing, setEditing] = useState<OperationRow | null>(null)
  const [toast, setToast] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  useEffect(() => {
    let active = true
    setLoading(true)
    getModuleRows(module).then(({ data }) => { if (active) { setRows(data); setPage(1) } }).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [module])

  useEffect(() => {
    const close = (event: PointerEvent) => { if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(null) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const serviceOptions = useMemo(() => {
    const sourceRows = rows.filter((row) => (!providerFilters.length || providerFilters.includes(String(row.provider))) && (!statusFilters.length || statusFilters.includes(String(row.status))))
    return [...new Set(sourceRows.map((row) => String(row.service || '')))].filter(Boolean)
  }, [rows, providerFilters, statusFilters])
  const providerOptions = useMemo(() => {
    const sourceRows = rows.filter((row) => (!serviceFilters.length || serviceFilters.includes(String(row.service))) && (!statusFilters.length || statusFilters.includes(String(row.status))))
    return [...new Set(sourceRows.map((row) => String(row.provider || '')))].filter(Boolean)
  }, [rows, serviceFilters, statusFilters])
  const statusOptions = useMemo(() => {
    const sourceRows = rows.filter((row) => (!serviceFilters.length || serviceFilters.includes(String(row.service))) && (!providerFilters.length || providerFilters.includes(String(row.provider))))
    return [...new Set(sourceRows.map((row) => String(row.status || '')))].filter(Boolean)
  }, [rows, serviceFilters, providerFilters])

  useEffect(() => {
    if (module !== 'services' || !serviceFilters.length) return
    const availableServices = new Set(serviceOptions)
    setServiceFilters((current) => {
      const next = current.filter((service) => availableServices.has(service))
      return next.length === current.length ? current : next
    })
  }, [module, serviceOptions, serviceFilters.length])

  useEffect(() => {
    if (module !== 'services' || !providerFilters.length) return
    const availableProviders = new Set(providerOptions)
    setProviderFilters((current) => {
      const next = current.filter((provider) => availableProviders.has(provider))
      return next.length === current.length ? current : next
    })
  }, [module, providerOptions, providerFilters.length])

  useEffect(() => {
    if (module !== 'services' || !statusFilters.length) return
    const availableStatuses = new Set(statusOptions)
    setStatusFilters((current) => {
      const next = current.filter((status) => availableStatuses.has(status))
      return next.length === current.length ? current : next
    })
  }, [module, statusOptions, statusFilters.length])
  const visibleRows = useMemo(() => rows.filter((row) => {
    const matchesQuery = Object.values(row).some((value) => String(value).toLowerCase().includes(query.toLowerCase()))
    const matchesService = module !== 'services' || !serviceFilters.length || serviceFilters.includes(String(row.service))
    const matchesProvider = module !== 'services' || !providerFilters.length || providerFilters.includes(String(row.provider))
    const matchesStatus = module !== 'services' || !statusFilters.length || statusFilters.includes(String(row.status))
    const rowDeadline = deadlineDate(row.deadline)
    const matchesDeadline = module !== 'services' || ((!deadlineFrom || rowDeadline >= deadlineFrom) && (!deadlineTo || rowDeadline <= deadlineTo))
    return matchesQuery && matchesService && matchesProvider && matchesStatus && matchesDeadline
  }), [rows, query, module, serviceFilters, providerFilters, statusFilters, deadlineFrom, deadlineTo])
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  async function act(row: OperationRow, action: string = config.action) {
    const result = await decide(module, String(row.id), action)
    setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: result.data.status } : item))
    setSelected(null); setToast(`${config.title}：${result.data.status}`); setTimeout(() => setToast(''), 2200)
  }

  async function saveEdit() {
    if (!editing?.name) return
    const { data } = await saveModuleRow(module, editing)
    setRows((current) => current.some((item) => item.id === data.id) ? current.map((item) => item.id === data.id ? data : item) : [data, ...current])
    setEditing(null); setSelected(null); setToast('资料已保存'); setTimeout(() => setToast(''), 2200)
  }
  async function remove(row: OperationRow) {
    if (!window.confirm(`确定删除“${row.name}”吗？`)) return
    await deleteModuleRow(module, String(row.id)); setRows((current) => current.filter((item) => item.id !== row.id)); setSelected(null); setToast('已删除'); setTimeout(() => setToast(''), 2200)
  }

  function toggleFilter(value: string, setter: Dispatch<SetStateAction<string[]>>) {
    setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); setPage(1)
  }

  return (
    <div className="operations-page">
      <div className="page-heading"><div><h1>{config.title}</h1><p>{config.description}</p></div>{module === 'config' ? <button className="primary-inline"><Plus size={17} />新建版本</button> : module === 'plots' ? <button className="primary-inline" onClick={() => setEditing({ id: '', name: '', owner: '', town: '', area: '', altitude: '', longitude: '', latitude: '', collectionMethod: '运营后台录入', status: '待核验' })}><Plus size={17} />新增地块</button> : null}</div>
      <section className="panel operation-panel">
        <div className="operation-toolbar" ref={filterRef}><div className="search-box"><Search size={17} /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder="搜索编号、名称或状态" /></div>{module === 'services' ? <><MultiFilter label="服务" values={serviceOptions} selected={serviceFilters} open={filterOpen === 'service'} onOpen={() => setFilterOpen(filterOpen === 'service' ? null : 'service')} onToggle={(value) => toggleFilter(value, setServiceFilters)} onClear={() => setServiceFilters([])} /><MultiFilter label="服务方" values={providerOptions} selected={providerFilters} open={filterOpen === 'provider'} onOpen={() => setFilterOpen(filterOpen === 'provider' ? null : 'provider')} onToggle={(value) => toggleFilter(value, setProviderFilters)} onClear={() => setProviderFilters([])} /><MultiFilter label="状态" values={statusOptions} selected={statusFilters} open={filterOpen === 'status'} onOpen={() => setFilterOpen(filterOpen === 'status' ? null : 'status')} onToggle={(value) => toggleFilter(value, setStatusFilters)} onClear={() => setStatusFilters([])} /><div className={`deadline-filter${deadlineCustom ? " custom-open" : ""}`}><button type="button" className={!deadlineFrom && !deadlineTo ? "active" : ""} onClick={() => { setDeadlineCustom(false); setDeadlineFrom(""); setDeadlineTo(""); setPage(1) }}>今日</button><button type="button" className={deadlineFrom === "2026-08-24" && deadlineTo === "2026-08-30" ? "active" : ""} onClick={() => { setDeadlineCustom(false); setDeadlineFrom("2026-08-24"); setDeadlineTo("2026-08-30"); setPage(1) }}>本周</button><button type="button" className={`deadline-custom-toggle${deadlineCustom ? " active" : ""}`} onClick={() => setDeadlineCustom(true)}>选择统计时间</button><input type="date" aria-label="时限开始日期" value={deadlineFrom} onChange={(event) => { setDeadlineFrom(event.target.value); setPage(1) }} /><span>至</span><input type="date" aria-label="时限结束日期" value={deadlineTo} min={deadlineFrom || undefined} onChange={(event) => { setDeadlineTo(event.target.value); setPage(1) }} /></div></> : <button className="secondary-button"><Filter size={16} />筛选</button>}<button className="icon-button" onClick={() => { setQuery(''); setServiceFilters([]); setProviderFilters([]); setStatusFilters([]); setDeadlineFrom(''); setDeadlineTo(''); setPage(1) }} aria-label="重置筛选"><RefreshCw size={17} /></button></div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>序号</th><th>编号</th>{config.columns.map(([, label]) => <th key={label}>{label}</th>)}<th>操作</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={config.columns.length + 3}><div className="table-loading">正在加载福安数据…</div></td></tr> : paginatedRows.length ? paginatedRows.map((row, index) => <tr key={String(row.id)}><td className="serial-cell">{(currentPage - 1) * pageSize + index + 1}</td><td><code>{String(row.id)}</code></td>{config.columns.map(([key]) => <td key={key}>{key === 'status' ? <StatusChip>{String(row[key])}</StatusChip> : String(row[key] ?? '—')}</td>)}<td>{module === 'services' ? <Link className="text-button" to={`/services/${row.id}`}>查看详情 <ChevronRight size={15} /></Link> : <button className="text-button" onClick={() => setSelected(row)}>查看处理 <ChevronRight size={15} /></button>}</td></tr>) : <tr><td colSpan={config.columns.length + 3}><div className="empty-table"><Search />没有找到匹配记录</div></td></tr>}
        </tbody></table></div>
        <PaginationBar total={visibleRows.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}/>
      </section>
      {selected ? <div className="drawer-layer"><button className="drawer-scrim" onClick={() => setSelected(null)} aria-label="关闭详情" /><aside className="detail-drawer"><div className="drawer-head"><div><span>{config.title}</span><h2>{String(selected.name ?? selected.title ?? selected.service ?? selected.permission ?? selected.id)}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="关闭"><X /></button></div>{module === 'members' ? <><div className="rating-summary"><div><span>任务完成度</span><strong>{String(selected.taskCompletion)}</strong></div><div><span>系统评分</span><strong><Star size={15} fill="currentColor"/>{String(selected.systemRating)}</strong></div><div><span>客户评分</span><strong><Star size={15} fill="currentColor"/>{String(selected.customerRating)}</strong></div><p>任务完成度由系统按已完成任务数 ÷ 应完成任务数自动计算，不是资料填写率。</p></div><div className="task-completion-detail"><div><strong>{String(selected.assignedTasks)}</strong><span>应完成</span></div><div><strong>{String(selected.completedTasks)}</strong><span>已完成</span></div><div className="warning"><strong>{String(selected.overdueTasks)}</strong><span>逾期</span></div><div className="danger"><strong>{String(selected.canceledTasks)}</strong><span>取消</span></div><div className="completion-track"><i style={{ width: String(selected.taskCompletion) }}/></div><small>统计口径：已进入履约阶段且主体承担责任的任务；已撤回和未分派任务不计入应完成数。</small></div></> : null}{module === 'services' ? <section className="service-detail-summary"><div className="service-detail-status"><span>当前状态</span><StatusChip>{String(selected.status)}</StatusChip></div><div className="service-detail-grid"><div><span>需求方</span><strong>{String(selected.grower)}</strong></div><div><span>服务项目</span><strong>{String(selected.service)}</strong></div><div><span>服务方</span><strong>{String(selected.provider)}</strong></div><div><span>时限</span><strong>{String(selected.deadline)}</strong></div></div><div className="service-detail-steps"><div className="done"><i/>需求已提交</div><div className={selected.status === '市场接单中' ? '' : 'done'}><i/>服务进入市场</div><div className={selected.status === '已完成' ? 'done' : ''}><i/>履约验收</div></div></section> : null}<dl>{Object.entries(selected).filter(([key]) => module !== 'members' || !['assignedTasks', 'completedTasks', 'overdueTasks', 'canceledTasks', 'taskCompletion', 'systemRating', 'customerRating'].includes(key)).map(([key, value]) => <div key={key}><dt>{module === 'members' ? memberLabels[key] || key : key}</dt><dd>{key === 'status' ? <StatusChip>{String(value)}</StatusChip> : String(value)}</dd></div>)}</dl><label className="drawer-note">处理说明<textarea placeholder="填写审核、发布或验收说明" defaultValue={module === 'audit' ? '已核对申请人与审批人不同，授权有效期为2小时。' : ''} /></label><div className="drawer-actions">{module === 'plots' || module === 'members' ? <button className="secondary-button danger-text" onClick={() => remove(selected)}><Trash2 size={16}/>删除</button> : null}{module === 'plots' || module === 'members' ? <button className="secondary-button" onClick={() => setEditing({ ...selected })}>编辑资料</button> : null}<button className="secondary-button" onClick={() => act(selected, 'reject')}><X size={16} />驳回</button><button className="primary-inline" onClick={() => act(selected)}><Check size={16} />{config.primary}</button></div></aside></div> : null}
      {editing ? <div className="drawer-layer"><button className="drawer-scrim" onClick={() => setEditing(null)} aria-label="关闭编辑"/><aside className="detail-drawer"><div className="drawer-head"><div><span>{module === 'plots' ? '地块资料' : '会员资料'}</span><h2>{editing.id ? '编辑资料' : '新增地块'}</h2></div><button className="icon-button" onClick={() => setEditing(null)}><X/></button></div>{module === 'members' ? <div className="derived-field-tip">任务完成度与两类评分由任务、验收和评价数据自动生成，不能在会员资料中手工修改。</div> : null}<div className="settings-form">{Object.entries(editing).filter(([key]) => !['id'].includes(key) && (module !== 'members' || !['assignedTasks', 'completedTasks', 'overdueTasks', 'canceledTasks', 'taskCompletion', 'systemRating', 'customerRating'].includes(key))).map(([key, value]) => <label key={key}><span>{({name:'名称', owner:'所有者', town:'所在地', area:'面积（亩）', altitude:'海拔（米）', longitude:'经度', latitude:'纬度', collectionMethod:'采集方式', status:'状态', identities:'多重身份（逗号分隔）', type:'主体类型', updatedAt:'更新时间'} as Record<string,string>)[key] || key}</span>{key === 'collectionMethod' ? <select value={String(value)} onChange={(e) => setEditing({...editing,[key]:e.target.value})}><option>运营后台录入</option><option>手机定位</option><option>地图选点</option><option>拍照识别</option><option>语音辅助</option><option>子女远程代录</option></select> : <input value={String(value)} onChange={(e) => setEditing({...editing,[key]:e.target.value})}/>}</label>)}</div><div className="drawer-actions"><button className="secondary-button" onClick={() => setEditing(null)}>取消</button><button className="primary-inline" onClick={saveEdit}><Check size={16}/>保存</button></div></aside></div> : null}
      {toast ? <div className="toast"><Check size={16} />{toast}</div> : null}
    </div>
  )
}


