import { AlertCircle, ArrowRight, CalendarDays, CalendarRange, Check, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getDashboard } from '../api/mock'
import { MetricStrip } from '../components/MetricStrip'
import { TrendChart } from '../components/TrendChart'
import type { DashboardData, DashboardRange } from '../types'

const ranges: Array<{ key: Exclude<DashboardRange, 'custom'>; label: string }> = [{ key: 'today', label: '今日' }, { key: 'week', label: '本周' }]

export function DashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const range = (['today', 'week', 'custom'].includes(searchParams.get('period') || '') ? searchParams.get('period') : 'today') as DashboardRange
  const dateFrom = searchParams.get('from') || '2026-08-01'
  const dateTo = searchParams.get('to') || '2026-08-29'
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [draftFrom, setDraftFrom] = useState(dateFrom)
  const [draftTo, setDraftTo] = useState(dateTo)
  const [dateError, setDateError] = useState('')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData((await getDashboard({ range, dateFrom, dateTo })).data) } catch (err) { setError(err instanceof Error ? err.message : '加载失败') } finally { setLoading(false) }
  }, [range, dateFrom, dateTo])
  useEffect(() => { void load() }, [load])

  if (loading && !data) return <DashboardSkeleton />
  if (error && !data) return <ErrorState message={error} retry={load} />
  if (!data) return null

  function applyCustomDate() {
    if (!draftFrom || !draftTo) return setDateError('请选择开始和结束日期')
    if (draftFrom > draftTo) return setDateError('开始日期不能晚于结束日期')
    setDateError(''); setShowDatePicker(false); setSearchParams({ period: 'custom', from: draftFrom, to: draftTo }, { replace: true })
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div><h1>运营工作台</h1><p>聚合福安一期关键运营指标与待处理事项</p></div>
        <div className="dashboard-time-cluster"><div className="dashboard-time-tools"><div className="time-node-switch" aria-label="工作台时间范围">{ranges.map((item) => <button key={item.key} aria-pressed={range === item.key} className={range === item.key ? 'active' : ''} onClick={() => { setShowDatePicker(false); setSearchParams({ period: item.key }, { replace: true }) }}>{item.label}</button>)}<button aria-pressed={range === 'custom'} className={range === 'custom' ? 'active' : ''} onClick={() => { setDraftFrom(dateFrom); setDraftTo(dateTo); setShowDatePicker((current) => !current) }}><CalendarRange size={14}/>时间选择</button></div><div className="updated-at"><CalendarDays size={17} />{data.periodLabel} · 更新于 {data.updatedAt}<button className="icon-button" onClick={load} aria-label="刷新工作台"><RefreshCw size={17} className={loading ? 'spin' : ''} /></button></div></div>{showDatePicker ? <div className="custom-date-panel" role="dialog" aria-label="自定义时间范围"><div className="custom-date-head"><div><strong>选择统计时间</strong><span>指标将按完整自然日汇总</span></div><button className="icon-button" onClick={() => setShowDatePicker(false)} aria-label="关闭时间选择"><X size={17}/></button></div><div className="custom-date-fields"><label><span>开始日期</span><input aria-label="开始日期" type="date" value={draftFrom} max={draftTo || undefined} onChange={(event) => setDraftFrom(event.target.value)}/></label><i>至</i><label><span>结束日期</span><input aria-label="结束日期" type="date" value={draftTo} min={draftFrom || undefined} onChange={(event) => setDraftTo(event.target.value)}/></label><button className="primary-inline" onClick={applyCustomDate}><Check size={15}/>应用时间</button></div>{dateError ? <p className="custom-date-error">{dateError}</p> : null}</div> : null}</div>
      </div>
      {error ? <div className="inline-warning"><AlertCircle size={17} />{error}<button onClick={load}>重试</button></div> : null}
      <MetricStrip metrics={data.metrics} comparisonLabel={data.comparisonLabel} />
      <div className="dashboard-grid">
        <section className="panel trend-panel">
          <div className="panel-head"><div><h2>{data.trendTitle}</h2><p>{data.trendCaption}</p></div><span className="settings-count">{data.periodLabel}</span></div>
          <TrendChart trend={data.trend} label={data.periodLabel} />
        </section>
        <section className="panel activity-panel">
          <div className="panel-head"><div><h2>近期动态</h2><p>最新业务状态变更</p></div></div>
          <ol className="activity-list">{data.activities.map((item) => <li key={`${item.time}-${item.title}`}><time>{item.time}</time><span><strong>{item.title}</strong><small>{item.detail}</small></span></li>)}</ol>
        </section>
        <section className="panel task-panel">
          <div className="panel-head"><div><h2>待办摘要</h2><p>优先处理会阻断业务闭环的事项</p></div></div>
          <div className="task-table" role="table" aria-label="运营待办">
            <div className="task-row head" role="row"><span>事项</span><span>待办数量</span><span>紧急程度</span><span>更新时间</span><span>操作</span></div>
            {data.tasks.map((task) => <button className="task-row" role="row" key={task.key} onClick={() => navigate(task.route)}><strong>{task.label}</strong><b>{task.count}</b><em className={task.urgency}>{task.urgency === 'high' ? '高' : task.urgency === 'medium' ? '中' : '低'}</em><time>{task.updatedAt}</time><span className="task-action">去处理 <ArrowRight size={15} /></span></button>)}
          </div>
        </section>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return <div className="dashboard-skeleton" aria-label="工作台加载中"><div className="skeleton-title" /><div className="skeleton-metrics">{Array.from({ length: 7 }, (_, i) => <i key={i} />)}</div><div className="skeleton-panels"><i /><i /><i /></div></div>
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="error-state"><AlertCircle size={34} /><h1>工作台暂时无法加载</h1><p>{message}</p><button className="secondary-button" onClick={retry}><RefreshCw size={16} />重试</button></div>
}
