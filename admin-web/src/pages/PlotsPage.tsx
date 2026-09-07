import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Filter, MapPinned, RefreshCw, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { fuanCropOptions, getModuleRows } from '../api/mock'
import { PaginationBar } from '../components/PaginationBar'
import { StatusChip } from '../components/StatusChip'
import type { OperationRow } from '../types'

type SortKey = 'id' | 'town' | 'name' | 'owner' | 'area' | 'altitude' | 'harvestYield' | 'harvestStart'
type SortState = { key: SortKey; direction: 'asc' | 'desc' }

const numericValue = (value: unknown) => Number.parseFloat(String(value)) || 0
const townshipValue = (value: unknown) => String(value).match(/^.*?(?:镇|乡|街道)/)?.[0] || String(value)
const demoToday = new Date('2026-08-29T00:00:00')

function harvestInfo(row: OperationRow) {
  const start = new Date(`${String(row.harvestStart)}T00:00:00`)
  const days = Math.round((start.getTime() - demoToday.getTime()) / 86400000)
  return {
    range: `${String(row.harvestStart).slice(5).replace('-', '.')}—${String(row.harvestEnd).slice(5).replace('-', '.')}`,
    countdown: days < 0 ? `已上市${Math.abs(days)}天` : days === 0 ? '今日上市' : `距上市${days}天`,
    tone: days <= 0 ? 'active' : days <= 7 ? 'urgent' : days <= 30 ? 'soon' : 'planned',
  }
}

export function PlotsPage() {
  const [rows, setRows] = useState<OperationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedTowns, setSelectedTowns] = useState<string[]>([])
  const [selectedCrops, setSelectedCrops] = useState<string[]>([])
  const [townOpen, setTownOpen] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [areaMin, setAreaMin] = useState('')
  const [areaMax, setAreaMax] = useState('')
  const [altitudeMin, setAltitudeMin] = useState('')
  const [altitudeMax, setAltitudeMax] = useState('')
  const [sort, setSort] = useState<SortState>({ key: 'id', direction: 'desc' })
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const townFilterRef = useRef<HTMLDivElement>(null)
  const cropFilterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    getModuleRows('plots').then(({ data }) => { if (active) setRows(data) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const close = (event: PointerEvent) => { if (!townFilterRef.current?.contains(event.target as Node)) setTownOpen(false); if (!cropFilterRef.current?.contains(event.target as Node)) setCropOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const towns = useMemo(() => {
    const sourceRows = selectedCrops.length ? rows.filter((row) => selectedCrops.includes(String(row.crop))) : rows
    return [...new Set(sourceRows.map((row) => townshipValue(row.town)))]
  }, [rows, selectedCrops])
  const crops = useMemo(() => {
    const sourceRows = selectedTowns.length ? rows.filter((row) => selectedTowns.includes(townshipValue(row.town))) : rows
    const sourceCrops = sourceRows.map((row) => String(row.crop)).filter(Boolean)
    const options = selectedTowns.length ? sourceCrops : [...fuanCropOptions, ...sourceCrops]
    return [...new Set(options)].sort((left, right) => left.localeCompare(right, 'zh-CN'))
  }, [rows, selectedTowns])

  useEffect(() => {
    if (!selectedTowns.length) return
    const availableTowns = new Set(towns)
    setSelectedTowns((current) => {
      const next = current.filter((town) => availableTowns.has(town))
      return next.length === current.length ? current : next
    })
  }, [towns, selectedTowns.length])

  useEffect(() => {
    if (!selectedCrops.length) return
    const availableCrops = new Set(crops)
    setSelectedCrops((current) => {
      const next = current.filter((crop) => availableCrops.has(crop))
      return next.length === current.length ? current : next
    })
  }, [crops, selectedCrops.length])
  const visibleRows = useMemo(() => rows.filter((row) => {
    const matchesQuery = !query || [row.id, row.name, row.owner, row.town].some((value) => String(value).toLowerCase().includes(query.toLowerCase()))
    const area = numericValue(row.area)
    const altitude = numericValue(row.altitude)
    return matchesQuery && (!selectedTowns.length || selectedTowns.includes(townshipValue(row.town))) && (!selectedCrops.length || selectedCrops.includes(String(row.crop))) && (!areaMin || area >= Number(areaMin)) && (!areaMax || area <= Number(areaMax)) && (!altitudeMin || altitude >= Number(altitudeMin)) && (!altitudeMax || altitude <= Number(altitudeMax))
  }).sort((left, right) => {
    const factor = sort.direction === 'asc' ? 1 : -1
    if (sort.key === 'area' || sort.key === 'altitude' || sort.key === 'harvestYield') return (numericValue(left[sort.key]) - numericValue(right[sort.key])) * factor
    if (sort.key === 'harvestStart') return (new Date(String(left.harvestStart)).getTime() - new Date(String(right.harvestStart)).getTime()) * factor
    return String(left[sort.key]).localeCompare(String(right[sort.key]), 'zh-CN', { numeric: true }) * factor
  }), [rows, query, selectedTowns, selectedCrops, areaMin, areaMax, altitudeMin, altitudeMax, sort])

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function toggleSort(key: SortKey) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }

  function toggleValue(value: string, setter: Dispatch<SetStateAction<string[]>>) {
    setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
    setPage(1)
  }

  function resetFilters() {
    setQuery(''); setSelectedTowns([]); setSelectedCrops([]); setTownOpen(false); setCropOpen(false); setAreaMin(''); setAreaMax(''); setAltitudeMin(''); setAltitudeMax(''); setPage(1)
  }

  function SortIcon({ column }: { column: SortKey }) {
    return sort.key !== column ? <ArrowUpDown size={13}/> : sort.direction === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/>
  }

  const sortHeader = (key: SortKey, label: string) => <th><button className="sortable-head" aria-label={`${label}排序`} onClick={() => toggleSort(key)}>{label}<SortIcon column={key}/></button></th>
  const sortButton = (key: SortKey, label: string) => <button className="sortable-head" aria-label={`${label}排序`} onClick={() => toggleSort(key)}>{label}<SortIcon column={key}/></button>

  return <div className="plots-page">
    <div className="page-heading"><div><h1>地块核验</h1><p>按所在地、面积和海拔筛选，并进入地块详情核验影像</p></div></div>
    <section className="panel plot-filter-panel">
      <div className="plot-filter-primary">
        <div className="search-box"><Search size={17}/><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="搜索编号、所在地、地块或所有者"/></div>
        <div className={`multi-filter${townOpen ? ' open' : ''}`} ref={townFilterRef}><button type="button" className="multi-filter-trigger" aria-haspopup="true" aria-expanded={townOpen} onClick={() => { setTownOpen((open) => !open); setCropOpen(false) }}>乡镇{selectedTowns.length ? `（${selectedTowns.length}）` : '：全部'}</button>{townOpen ? <div className="multi-filter-panel town-filter-panel" role="group" aria-label="乡镇多选">{towns.map((item) => <label key={item}><input type="checkbox" checked={selectedTowns.includes(item)} onChange={() => toggleValue(item, setSelectedTowns)}/><span>{item}</span></label>)}<div className="multi-filter-actions"><button type="button" onClick={() => { setSelectedTowns([]); setPage(1) }}>清空</button><button type="button" onClick={() => setTownOpen(false)}>完成</button></div></div> : null}</div>
        <div className={`multi-filter${cropOpen ? ' open' : ''}`} ref={cropFilterRef}><button type="button" className="multi-filter-trigger" aria-haspopup="true" aria-expanded={cropOpen} onClick={() => { setCropOpen((open) => !open); setTownOpen(false) }}>作物{selectedCrops.length ? `（${selectedCrops.length}）` : '：全部'}</button>{cropOpen ? <div className="multi-filter-panel town-filter-panel" role="group" aria-label="作物多选">{crops.map((item) => <label key={item}><input type="checkbox" checked={selectedCrops.includes(item)} onChange={() => toggleValue(item, setSelectedCrops)}/><span>{item}</span></label>)}<div className="multi-filter-actions"><button type="button" onClick={() => { setSelectedCrops([]); setPage(1) }}>清空</button><button type="button" onClick={() => setCropOpen(false)}>完成</button></div></div> : null}</div>
        <button className="icon-button" aria-label="重置筛选" onClick={resetFilters}><RefreshCw size={17}/></button>
      </div>
      <div className="plot-range-filters">
        <Filter size={15}/><span>区间筛选</span>
        <label>面积<input aria-label="最小面积" type="number" min="0" value={areaMin} onChange={(event) => { setAreaMin(event.target.value); setPage(1) }} placeholder="最小"/><i>—</i><input aria-label="最大面积" type="number" min="0" value={areaMax} onChange={(event) => { setAreaMax(event.target.value); setPage(1) }} placeholder="最大"/><small>亩</small></label>
        <label>海拔<input aria-label="最低海拔" type="number" value={altitudeMin} onChange={(event) => { setAltitudeMin(event.target.value); setPage(1) }} placeholder="最低"/><i>—</i><input aria-label="最高海拔" type="number" value={altitudeMax} onChange={(event) => { setAltitudeMax(event.target.value); setPage(1) }} placeholder="最高"/><small>米</small></label>
      </div>
    </section>
    <section className="panel operation-panel">
      <div className="data-table-wrap"><table className="data-table plot-table">
        <thead><tr><th>序号</th>{sortHeader('id', '编号')}{sortHeader('town', '所在地/地块')}<th>作物</th><th className="merged-metrics-head">{sortButton('area', '面积')}{sortButton('harvestYield', '采收量')}{sortButton('altitude', '海拔')}</th>{sortHeader('harvestStart', '采收期/上市')}{sortHeader('owner', '所有者')}<th>采集方式</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={10}><div className="table-loading">正在加载地块数据…</div></td></tr> : paginatedRows.length ? paginatedRows.map((row, index) => { const harvest = harvestInfo(row); return <tr key={String(row.id)}><td className="serial-cell">{(currentPage - 1) * pageSize + index + 1}</td><td><code>{String(row.id)}</code></td><td><div className="plot-place-cell"><span className="plot-location"><MapPinned size={14}/>{String(row.town)}</span><strong>{String(row.name)}</strong></div></td><td><span className="crop-chip">{String(row.crop)}</span></td><td><div className="plot-metrics-cell"><span><small>面积</small><strong>{String(row.area)}</strong></span><span><small>采收量</small><strong>{String(row.harvestYield)}</strong></span><span><small>海拔</small><strong>{String(row.altitude)}</strong></span></div></td><td><div className={`harvest-cell ${harvest.tone}`}><i/><span><strong>{harvest.range}</strong><small>{harvest.countdown}</small><em>{String(row.harvestStatus || '采收中')} · 已采 {String(row.harvestedAmount || '0吨')} · 剩 {String(row.remainingAmount || row.pendingHarvest || '0吨')}</em></span></div></td><td>{String(row.owner)}</td><td>{String(row.collectionMethod)}</td><td><StatusChip>{String(row.status)}</StatusChip></td><td><Link className="detail-link" to={`/plots/${row.id}`}>查看详情 <ChevronRight size={15}/></Link></td></tr> }) : <tr><td colSpan={10}><div className="empty-table"><Search/>没有符合条件的地块</div></td></tr>}</tbody>
      </table></div>
      <PaginationBar total={visibleRows.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}/>
    </section>
  </div>
}
