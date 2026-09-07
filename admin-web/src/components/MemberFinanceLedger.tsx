import { RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createMemberLedger, formatTransactionAmount } from '../api/memberFinance'
import type { MemberActivity, OperationRow } from '../types'
import { PaginationBar } from './PaginationBar'
import './MemberFinanceLedger.css'

export function MemberFinanceLedger({ member, activities, returnTo }: { member: OperationRow; activities?: MemberActivity[]; returnTo?: string }) {
  const transactions = useMemo(() => createMemberLedger(member, activities), [member, activities])
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)
  const [direction, setDirection] = useState('')
  const [sort, setSort] = useState<{ key: 'occurredAt' | 'amountCents'; ascending: boolean }>({ key: 'occurredAt', ascending: false })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return transactions.filter((row) => !invalidDateRange && (!dateFrom || row.occurredAt.slice(0, 10) >= dateFrom) && (!dateTo || row.occurredAt.slice(0, 10) <= dateTo) &&
      (!direction || row.direction === direction) &&
      (!keyword || [row.id, row.business, row.counterparty, row.occurredAt, row.taskId || '', row.result || '', row.identity || ''].some((text) => text.toLowerCase().includes(keyword))))
      .sort((a, b) => {
        if (sort.key === 'amountCents') {
          if (a.amountCents === null) return b.amountCents === null ? b.occurredAt.localeCompare(a.occurredAt) : 1
          if (b.amountCents === null) return -1
          return (sort.ascending ? 1 : -1) * (a.amountCents - b.amountCents)
        }
        return (sort.ascending ? 1 : -1) * a.occurredAt.localeCompare(b.occurredAt)
      })
  }, [transactions, query, direction, sort, dateFrom, dateTo, invalidDateRange])
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function reset() {
    setQuery(''); setDateFrom(''); setDateTo(''); setDirection(''); setPage(1)
    setSort({ key: 'occurredAt', ascending: false })
  }

  return <section className="finance-ledger" aria-label="业务活动与收支明细">
    <div className="finance-ledger-heading"><h3>业务活动与收支明细</h3></div>
    <div className="operation-toolbar finance-ledger-filters">
      <div className="search-box"><Search size={17} aria-hidden="true" /><input aria-label="搜索收支明细" placeholder="搜索任务、流水、业务或交易方" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /></div>
      <div className="finance-date-range" role="group" aria-label="收支时间范围">
        <input type="date" aria-label="收支开始日期" aria-invalid={invalidDateRange} aria-describedby={invalidDateRange ? 'finance-date-error' : undefined} value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} />
        <span>至</span>
        <input type="date" aria-label="收支结束日期" aria-invalid={invalidDateRange} aria-describedby={invalidDateRange ? 'finance-date-error' : undefined} value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} />
      </div>
      <select aria-label="记录类型" value={direction} onChange={(event) => { setDirection(event.target.value); setPage(1) }}><option value="">类型：全部</option><option value="activity">业务活动</option><option value="income">收入</option><option value="expense">支出</option></select>
      <select aria-label="记录排序" value={`${sort.key}-${sort.ascending ? 'asc' : 'desc'}`} onChange={(event) => { const [key, order] = event.target.value.split('-'); setSort({ key: key as 'occurredAt' | 'amountCents', ascending: order === 'asc' }); setPage(1) }}><option value="occurredAt-desc">时间：由近到远</option><option value="occurredAt-asc">时间：由远到近</option><option value="amountCents-desc">金额：由高到低</option><option value="amountCents-asc">金额：由低到高</option></select>
      <button type="button" className="icon-button" aria-label="重置收支筛选" title="重置筛选" onClick={reset}><RefreshCw size={17} /></button>
    </div>
    {invalidDateRange ? <p id="finance-date-error" className="finance-date-error" role="alert">开始日期不能晚于结束日期，请调整时间范围。</p> : null}
    {visible.length ? <ol className="ledger-timeline" aria-label="业务活动与收支时间线">
      {visible.map((row) => <li key={row.id} className={`ledger-event ledger-${row.direction}`}>
        <div className="ledger-event-time"><time dateTime={row.occurredAt.replace(' ', 'T')}>{row.occurredAt}</time></div>
        <div className="ledger-event-body">
          <div className="ledger-event-heading"><span className={`finance-direction finance-${row.direction}`}>{row.direction === 'income' ? '收入' : row.direction === 'expense' ? '支出' : '业务活动'}</span>{row.identity ? <span>{row.identity}</span> : null}<span className={`finance-amount finance-${row.direction}`}>{row.amountCents === null ? '—' : `${row.direction === 'income' ? '+' : '−'}${formatTransactionAmount(row.amountCents)}`}</span></div>
          <strong>{row.taskId ? <Link className="detail-link" to={`/tasks/${encodeURIComponent(row.taskId)}?from=${encodeURIComponent(returnTo || `/members/${member.id}`)}`} title="查看任务详情">{row.business}</Link> : row.business}</strong>
          <p>{row.counterparty}</p>
          {row.result ? <p className="ledger-result">{row.result}</p> : null}
          <div className="ledger-event-meta"><span>{row.taskId || row.id}</span>{row.channel !== '—' ? <span>{row.channel}</span> : null}<span className={`status-chip ${row.direction === 'activity' ? 'neutral' : 'positive'}`}>{row.status}</span></div>
        </div>
      </li>)}
    </ol> : <div className="empty-table">没有匹配的记录</div>}
    <PaginationBar total={filtered.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
  </section>
}
