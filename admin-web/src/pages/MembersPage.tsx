import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, RefreshCw, Search, Star } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getModuleRows } from '../api/mock'
import { PaginationBar } from '../components/PaginationBar'
import { StatusChip } from '../components/StatusChip'
import type { OperationRow } from '../types'

type SortKey = 'taskCompletion' | 'systemRating' | 'customerRating'
type SortState = { key: SortKey; direction: 'asc' | 'desc' } | null

const numericValue = (value: unknown) => Number.parseFloat(String(value)) || 0
const formatCurrency = (value: unknown) => `¥${numericValue(value).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
const townshipValue = (value: unknown) => String(value).match(/^.*?(?:镇|乡|街道)/)?.[0] || String(value)

export function MembersPage() {
  const [rows, setRows] = useState<OperationRow[]>([])
  const [query, setQuery] = useState('')
  const [towns, setTowns] = useState<string[]>([])
  const [townOpen, setTownOpen] = useState(false)
  const [selectedIdentities, setSelectedIdentities] = useState<string[]>([])
  const [identityOpen, setIdentityOpen] = useState(false)
  const [statuses, setStatuses] = useState<string[]>([])
  const [statusOpen, setStatusOpen] = useState(false)
  const [sort, setSort] = useState<SortState>(null)
  const [loading, setLoading] = useState(true)
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const identityFilterRef = useRef<HTMLDivElement>(null)
  const statusFilterRef = useRef<HTMLDivElement>(null)
  const townFilterRef = useRef<HTMLDivElement>(null)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  useEffect(() => {
    let active = true
    getModuleRows('members').then(({ data }) => { if (active) setRows(data) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!identityFilterRef.current?.contains(event.target as Node)) setIdentityOpen(false)
      if (!statusFilterRef.current?.contains(event.target as Node)) setStatusOpen(false)
      if (!townFilterRef.current?.contains(event.target as Node)) setTownOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') { setIdentityOpen(false); setStatusOpen(false); setTownOpen(false) }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const townOptions = useMemo(() => {
    const sourceRows = rows.filter((row) => {
      const rowIdentities = String(row.identities).split('、')
      return (!selectedIdentities.length || selectedIdentities.some((item) => rowIdentities.includes(item))) && (!statuses.length || statuses.includes(String(row.status)))
    })
    return [...new Set(sourceRows.map((row) => townshipValue(row.town)))]
  }, [rows, selectedIdentities, statuses])
  const identityOptions = useMemo(() => {
    const sourceRows = rows.filter((row) => (!towns.length || towns.includes(townshipValue(row.town))) && (!statuses.length || statuses.includes(String(row.status))))
    return [...new Set(sourceRows.flatMap((row) => String(row.identities).split('、')).filter(Boolean))]
  }, [rows, towns, statuses])
  const statusOptions = useMemo(() => {
    const sourceRows = rows.filter((row) => {
      const rowIdentities = String(row.identities).split('、')
      return (!towns.length || towns.includes(townshipValue(row.town))) && (!selectedIdentities.length || selectedIdentities.some((item) => rowIdentities.includes(item)))
    })
    return [...new Set(sourceRows.map((row) => String(row.status)).filter(Boolean))]
  }, [rows, towns, selectedIdentities])

  useEffect(() => {
    if (!towns.length) return
    const availableTowns = new Set(townOptions)
    setTowns((current) => {
      const next = current.filter((town) => availableTowns.has(town))
      return next.length === current.length ? current : next
    })
  }, [townOptions, towns.length])

  useEffect(() => {
    if (!selectedIdentities.length) return
    const availableIdentities = new Set(identityOptions)
    setSelectedIdentities((current) => {
      const next = current.filter((identity) => availableIdentities.has(identity))
      return next.length === current.length ? current : next
    })
  }, [identityOptions, selectedIdentities.length])

  useEffect(() => {
    if (!statuses.length) return
    const availableStatuses = new Set(statusOptions)
    setStatuses((current) => {
      const next = current.filter((status) => availableStatuses.has(status))
      return next.length === current.length ? current : next
    })
  }, [statusOptions, statuses.length])
  const visibleRows = useMemo(() => rows.filter((row) => {
    const matchesQuery = !deferredQuery || [row.id, row.name, row.identities, row.town, row.status].some((value) => String(value).toLowerCase().includes(deferredQuery))
    const rowIdentities = String(row.identities).split('、')
    const matchesIdentity = selectedIdentities.length === 0 || selectedIdentities.some((item) => rowIdentities.includes(item))
    const matchesStatus = statuses.length === 0 || statuses.includes(String(row.status))
    return matchesQuery && (towns.length === 0 || towns.includes(townshipValue(row.town))) && matchesIdentity && matchesStatus
  }).sort((left, right) => {
    if (!sort) return 0
    const factor = sort.direction === 'asc' ? 1 : -1
    return (numericValue(left[sort.key]) - numericValue(right[sort.key])) * factor
  }), [rows, deferredQuery, towns, selectedIdentities, statuses, sort])

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function toggleStatus(status: string) {
    setStatuses((current) => current.includes(status) ? current.filter((item) => item !== status) : [...current, status])
    setPage(1)
  }

  function toggleIdentity(identity: string) {
    setSelectedIdentities((current) => current.includes(identity) ? current.filter((item) => item !== identity) : [...current, identity])
    setPage(1)
  }

  function toggleTown(town: string) {
    setTowns((current) => current.includes(town) ? current.filter((item) => item !== town) : [...current, town])
    setPage(1)
  }

  function toggleSort(key: SortKey) {
    setSort((current) => ({ key, direction: current?.key === key && current.direction === 'desc' ? 'asc' : 'desc' }))
    setPage(1)
  }

  function resetFilters() {
    setQuery(''); setTowns([]); setTownOpen(false); setSelectedIdentities([]); setIdentityOpen(false); setStatuses([]); setStatusOpen(false); setSort(null); setPage(1)
  }

  function SortIcon({ column }: { column: SortKey }) {
    return sort?.key !== column ? <ArrowUpDown size={13}/> : sort.direction === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/>
  }

  const sortHeader = (key: SortKey, label: string) => <th><button className="sortable-head" aria-label={`${label}排序`} onClick={() => toggleSort(key)}>{label}<SortIcon column={key}/></button></th>

  return <div className="members-page">
    <div className="page-heading"><div><h1>会员与主体</h1><p>集中查看多重身份、任务履约表现和主体评级</p></div></div>
    <section className="member-overview" aria-label="会员概览">
      <div><span>会员与主体</span><strong>{rows.length}</strong><small>当前一期演示数据</small></div>
      <div><span>多身份会员</span><strong>{rows.filter((row) => String(row.identities).includes('、')).length}</strong><small>可按身份参与不同业务</small></div>
      <div><span>平均任务完成度</span><strong>{rows.length ? `${Math.round(rows.reduce((sum, row) => sum + numericValue(row.taskCompletion), 0) / rows.length)}%` : '—'}</strong><small>系统自动统计</small></div>
    </section>
    <section className="panel operation-panel">
      <div className="operation-toolbar member-filter-toolbar">
        <div className="search-box"><Search size={17}/><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="搜索编号、名称、身份或乡镇"/></div>
        <div className={`multi-filter${townOpen ? ' open' : ''}`} ref={townFilterRef}><button type="button" className="multi-filter-trigger" aria-haspopup="true" aria-expanded={townOpen} onClick={() => { setTownOpen((open) => !open); setIdentityOpen(false); setStatusOpen(false) }}>乡镇{towns.length ? `（${towns.length}）` : '：全部'}</button>{townOpen ? <div className="multi-filter-panel town-filter-panel" role="group" aria-label="乡镇多选">{townOptions.map((item) => <label key={item}><input type="checkbox" checked={towns.includes(item)} onChange={() => toggleTown(item)}/><span>{item}</span></label>)}<div className="multi-filter-actions"><button type="button" onClick={() => { setTowns([]); setPage(1) }}>清空</button><button type="button" onClick={() => setTownOpen(false)}>完成</button></div></div> : null}</div>
        <div className={`multi-filter${identityOpen ? ' open' : ''}`} ref={identityFilterRef}><button type="button" className="multi-filter-trigger" aria-haspopup="true" aria-expanded={identityOpen} onClick={() => { setIdentityOpen((open) => !open); setStatusOpen(false) }}>身份{selectedIdentities.length ? `（${selectedIdentities.length}）` : '：全部'}</button>{identityOpen ? <div className="multi-filter-panel identity-filter-panel" role="group" aria-label="身份多选">{identityOptions.map((item) => <label key={item}><input type="checkbox" checked={selectedIdentities.includes(item)} onChange={() => toggleIdentity(item)}/><span className="identity-filter-tag">{item}</span></label>)}<div className="multi-filter-actions"><button type="button" onClick={() => { setSelectedIdentities([]); setPage(1) }}>清空</button><button type="button" onClick={() => setIdentityOpen(false)}>完成</button></div></div> : null}</div>
        <div className={`multi-filter${statusOpen ? ' open' : ''}`} ref={statusFilterRef}><button type="button" className="multi-filter-trigger" aria-haspopup="true" aria-expanded={statusOpen} onClick={() => { setStatusOpen((open) => !open); setIdentityOpen(false) }}>状态{statuses.length ? `（${statuses.length}）` : '：全部'}</button>{statusOpen ? <div className="multi-filter-panel" role="group" aria-label="状态多选">{statusOptions.map((status) => <label key={status}><input type="checkbox" checked={statuses.includes(status)} onChange={() => toggleStatus(status)}/><StatusChip>{status}</StatusChip></label>)}<div className="multi-filter-actions"><button type="button" onClick={() => { setStatuses([]); setPage(1) }}>清空</button><button type="button" onClick={() => setStatusOpen(false)}>完成</button></div></div> : null}</div>
        <button className="icon-button" onClick={resetFilters} aria-label="重置筛选"><RefreshCw size={17}/></button>
      </div>
      <div className="data-table-wrap"><table className="data-table member-table">
        <thead><tr><th>序号</th><th>编号</th><th>姓名/主体</th><th>多重身份</th>{sortHeader('taskCompletion', '任务完成度')}{sortHeader('systemRating', '系统评分')}{sortHeader('customerRating', '客户评分')}<th>支出金额</th><th>收入金额</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={11}><div className="table-loading">正在加载会员数据…</div></td></tr> : paginatedRows.length ? paginatedRows.map((row, index) => <tr key={String(row.id)}><td className="serial-cell">{(currentPage - 1) * pageSize + index + 1}</td><td><code>{String(row.id)}</code></td><td><strong>{String(row.name)}</strong><small>{String(row.type)} · {String(row.town)}</small></td><td><div className="identity-tags">{String(row.identities).split('、').map((item) => <span key={item}>{item}</span>)}</div></td><td><div className="completion-cell"><strong>{String(row.taskCompletion)}</strong><i><b style={{ width: String(row.taskCompletion) }}/></i><small>{String(row.completedTasks)}/{String(row.assignedTasks)} 项</small></div></td><td><span className="score-cell"><Star size={13} fill="currentColor"/>{String(row.systemRating)}</span></td><td><span className="score-cell"><Star size={13} fill="currentColor"/>{String(row.customerRating)}</span></td><td><span className="money-cell expense">{formatCurrency(row.expenseAmount)}</span></td><td><span className="money-cell income">{formatCurrency(row.incomeAmount)}</span></td><td><StatusChip>{String(row.status)}</StatusChip></td><td><Link className="detail-link" to={`/members/${row.id}`}>查看详情 <ChevronRight size={15}/></Link></td></tr>) : <tr><td colSpan={11}><div className="empty-table"><Search/>没有找到匹配会员</div></td></tr>}</tbody>
      </table></div>
      <PaginationBar total={visibleRows.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}/>
    </section>
  </div>
}
