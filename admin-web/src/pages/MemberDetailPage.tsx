import { ArrowLeft, CalendarDays, Check, CircleUserRound, ClipboardCheck, MapPin, Pencil, Star, TrendingUp, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { decide, getMember, getMemberPerformance } from '../api/mock'
import { StatusChip } from '../components/StatusChip'
import { MemberFinanceLedger } from '../components/MemberFinanceLedger'
import { MemberProfileEditor } from '../components/MemberProfileEditor'
import { MemberIdentityMenu } from '../components/MemberIdentityMenu'
import { PaymentAccountIcons, type PaymentKey } from '../components/PaymentAccountIcons'
import type { MemberPerformance, OperationRow } from '../types'

const numericValue = (value: unknown) => Number.parseFloat(String(value)) || 0
const formatCurrency = (value: unknown) => `¥${numericValue(value).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`

export function MemberDetailPage() {
  const { memberId = '' } = useParams()
  const location = useLocation()
  const [member, setMember] = useState<OperationRow | null>(null)
  const [performance, setPerformance] = useState<MemberPerformance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState(false)
  const [payments, setPayments] = useState<Record<PaymentKey, string>>({ wechatBinding: '未绑定' })
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setEditing(false)
    Promise.all([getMember(memberId), getMemberPerformance(memberId)]).then(([memberResponse, performanceResponse]) => { if (active) { setMember(memberResponse.data); setPerformance(performanceResponse.data); setPayments({ wechatBinding: String(memberResponse.data.wechatBinding || '未绑定') }) } }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : '加载失败') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [memberId])

  async function audit(action: 'approve' | 'reject') {
    if (!member) return
    const { data } = await decide('members', String(member.id), action)
    setMember((current) => current ? { ...current, status: data.status } : current)
    setToast(action === 'approve' ? '主体审核已通过' : '主体申请已驳回')
    setTimeout(() => setToast(''), 2000)
  }

  function bindPayment(key: PaymentKey, label: string) {
    const demoBindings: Record<PaymentKey, string> = { wechatBinding: `${String(member?.name || '会员').slice(0, 1)}**` }
    setPayments((current) => ({ ...current, [key]: demoBindings[key] }))
    setToast(`${label}绑定信息已保存`)
    setTimeout(() => setToast(''), 2000)
  }

  if (loading) return <div className="member-detail-loading">正在加载会员详情…</div>
  if (!member || !performance || error) return <div className="error-state"><CircleUserRound size={42}/><h1>会员不存在</h1><p>{error || '无法找到该会员或主体'}</p><Link className="primary-inline" to="/members">返回会员列表</Link></div>

  return <div className="member-detail-page">
    <div className="detail-breadcrumb"><Link to="/members"><ArrowLeft size={16}/>会员与主体列表</Link><span>/</span><strong>{String(member.name)}</strong></div>
    <header className="member-profile-head"><div className="member-profile-main"><div className="member-avatar">{String(member.name).slice(0, 1)}</div><div><div className="member-title-row"><h1>{String(member.name)}</h1><StatusChip>{String(member.status)}</StatusChip><MemberIdentityMenu identities={String(member.identities || '')} /></div><p><span><CircleUserRound size={14}/>{String(member.type)}</span><span><MapPin size={14}/>{String(member.town)}</span><span><CalendarDays size={14}/>更新于 {String(member.updatedAt)}</span></p></div></div><button className="secondary-button" onClick={() => setEditing(true)}><Pencil size={15}/>编辑主体资料</button></header>
    <div className="member-detail-layout">
      <main>
        <section className="panel detail-section"><div className="panel-head"><div><h2>任务履约表现</h2><p>统计主体承担责任且已进入履约阶段的任务</p></div><span className="completion-badge">{String(member.taskCompletion)}</span></div><div className="member-task-metrics"><div><span>应完成任务</span><strong>{String(member.assignedTasks)}</strong></div><div><span>已完成任务</span><strong>{String(member.completedTasks)}</strong></div><div className="warning"><span>逾期任务</span><strong>{String(member.overdueTasks)}</strong></div><div className="danger"><span>取消任务</span><strong>{String(member.canceledTasks)}</strong></div></div><div className="detail-progress"><div><span>任务完成度</span><strong>{String(member.taskCompletion)}</strong></div><i><b style={{ width: String(member.taskCompletion) }}/></i><p>由系统按“已完成任务数 ÷ 应完成任务数”自动计算；已撤回、未分派任务不计入应完成数。</p></div></section>
        <section className="panel detail-section member-profile-panel">
          <div className="panel-head member-profile-tools">
            <div className="member-profile-heading"><h2>身份与主体资料</h2></div>
            <PaymentAccountIcons key={String(member.id)} payments={payments} onBind={bindPayment} />
          </div>
          <dl className="profile-data member-profile-data">
            <div><dt>会员编号</dt><dd>{String(member.id)}</dd></div>
            <div><dt>主体类型</dt><dd>{String(member.type)}</dd></div>
            <div><dt>所在乡镇</dt><dd>{String(member.town)}</dd></div>
            <div><dt>虚拟电话</dt><dd>{String(member.virtualPhone)}<small className="virtual-phone-note">保护真实号码</small></dd></div>
            <div><dt>当前状态</dt><dd><StatusChip>{String(member.status)}</StatusChip></dd></div>
            <div><dt>更新时间</dt><dd>{String(member.updatedAt)}</dd></div>
            <div><dt>累计支出</dt><dd className="profile-expense">{formatCurrency(member.expenseAmount)}</dd></div>
            <div><dt>累计收入</dt><dd className="profile-income">{formatCurrency(member.incomeAmount)}</dd></div>
          </dl>
        </section>
        <section className="panel detail-section member-events-panel">
          <MemberFinanceLedger key={String(member.id)} member={member} activities={performance.activities} returnTo={location.pathname + location.search} />
        </section>
      </main>
      <aside>
        <section className="panel rating-panel"><div className="panel-head"><div><h2>主体评级</h2><p>评分由业务数据与实名评价产生</p></div></div><div className="rating-card system"><span>系统评分</span><strong><Star size={20} fill="currentColor"/>{String(member.systemRating)}</strong><small>综合完成度、准时率、验收结果、响应时效和取消率</small></div><div className="rating-card customer"><span>客户评分</span><strong><Star size={20} fill="currentColor"/>{String(member.customerRating)}</strong><small>来自任务完成后的实名客户评价</small></div></section>
        <section className="panel audit-panel"><h2>主体审核</h2><p>审核操作将写入审计日志。</p><textarea placeholder="填写审核说明"/><div><button className="secondary-button danger-text" onClick={() => audit('reject')}><X size={16}/>驳回</button><button className="primary-inline" onClick={() => audit('approve')}><Check size={16}/>审核通过</button></div></section>
        <section className="panel remediation-panel"><div className="remediation-head"><ClipboardCheck size={19}/><div><h2>完成度补救措施</h2><StatusChip>{performance.remediation.status}</StatusChip></div></div><div className="remediation-issue"><strong>当前问题</strong><p>{performance.remediation.issue}</p></div><ol>{performance.remediation.measures.map((measure) => <li key={measure}>{measure}</li>)}</ol><dl><div><dt>责任人</dt><dd>{performance.remediation.owner}</dd></div><div><dt>截止时间</dt><dd>{performance.remediation.dueAt}</dd></div></dl><div className="effect-card"><div><TrendingUp size={18}/><span>补救效果</span></div><strong>{performance.remediation.beforeCompletion} <i>→</i> {performance.remediation.currentCompletion}</strong><p>{performance.remediation.effect}</p><small>最近复盘：{performance.remediation.reviewedAt}</small></div></section>
      </aside>
    </div>
    {editing ? <MemberProfileEditor key={String(member.id)} member={member} onClose={() => setEditing(false)} onSaved={(updated) => { setMember(updated); setEditing(false); setToast('主体资料已保存'); setTimeout(() => setToast(''), 2000) }} /> : null}
    {toast ? <div className="toast"><Check size={16}/>{toast}</div> : null}
  </div>
}
