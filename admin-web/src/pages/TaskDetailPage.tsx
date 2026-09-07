import { ArrowLeft, CalendarClock, CheckCircle2, CircleUserRound, ClipboardList, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getMemberTask } from '../api/mock'
import { StatusChip } from '../components/StatusChip'
import type { MemberTaskDetail } from '../types'

export function TaskDetailPage() {
  const { taskId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [task, setTask] = useState<MemberTaskDetail | null>(null)
  const [error, setError] = useState('')
  const from = searchParams.get('from')
  const backPath = from?.startsWith('/members/') ? from : '/members'

  useEffect(() => {
    let active = true
    getMemberTask(taskId).then(({ data }) => { if (active) setTask(data) }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : '任务加载失败') })
    return () => { active = false }
  }, [taskId])

  if (error) return <div className="error-state"><ClipboardList size={42}/><h1>任务不存在</h1><p>{error}</p><Link className="primary-inline" to={backPath}>返回会员详情</Link></div>
  if (!task) return <div className="member-detail-loading">正在加载任务详情…</div>

  return <div className="task-detail-page"><div className="detail-breadcrumb"><Link to={backPath}><ArrowLeft size={16}/>返回会员时间线</Link><span>/</span><strong>{task.id}</strong></div><header className="task-profile-head"><div><span>{task.category}</span><h1>{task.title}</h1><p>任务编号：{task.id}</p></div><StatusChip>{task.status}</StatusChip></header><div className="task-detail-grid"><main><section className="panel task-info-panel"><div className="panel-head"><div><h2>任务信息</h2><p>从会员业务时间线进入的具体任务</p></div></div><dl><div><dt><CircleUserRound size={15}/>执行主体</dt><dd><Link to={`/members/${task.memberId}`}>{task.memberName}</Link></dd></div><div><dt><ClipboardList size={15}/>执行身份</dt><dd>{task.identity}</dd></div><div><dt><MapPin size={15}/>业务对象</dt><dd>{task.target}</dd></div><div><dt><CalendarClock size={15}/>计划时间</dt><dd>{task.plannedAt}</dd></div><div><dt><CheckCircle2 size={15}/>实际完成</dt><dd>{task.occurredAt}</dd></div><div><dt>执行人员</dt><dd>{task.operator}</dd></div></dl></section><section className="panel task-result-panel"><div className="panel-head"><div><h2>执行结果</h2><p>任务验收或业务处理结果</p></div></div><div><CheckCircle2 size={24}/><strong>{task.result}</strong><p>该结果已纳入会员任务完成度与系统评分计算。</p></div></section></main><aside className="panel task-log-panel"><div className="panel-head"><div><h2>任务日志</h2><p>关键节点留痕</p></div></div><ol>{task.workLog.map((log, index) => <li key={log}><span>{index + 1}</span><p>{log}</p></li>)}</ol></aside></div></div>
}
