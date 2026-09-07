export type ApiEnvelope<T> = {
  code: number
  errorCode?: string
  message: string
  data: T
  traceId: string
  timestamp: string
}

export type Session = {
  token: string
  user: { id: string; name: string; phone: string; role: string }
}

export type Metric = {
  key: string
  label: string
  value: string
  unit: string
  delta: number
  icon: string
}

export type TaskSummary = {
  key: string
  label: string
  count: number
  urgency: 'high' | 'medium' | 'low'
  route: string
  updatedAt: string
}

export type DashboardData = {
  updatedAt: string
  periodLabel: string
  comparisonLabel: string
  trendTitle: string
  trendCaption: string
  metrics: Metric[]
  trend: Array<{ date: string; tasks: number; alerts: number; weather: number }>
  tasks: TaskSummary[]
  activities: Array<{ time: string; title: string; detail: string }>
}

export type DashboardRange = 'today' | 'week' | 'custom'

export type OperationRow = Record<string, string | number>

export type MemberActivity = {
  id: string
  taskId: string
  occurredAt: string
  action: string
  target: string
  identity: string
  result: string
  tone: 'positive' | 'warning' | 'neutral'
}

export type MemberTaskDetail = {
  id: string
  memberId: string
  memberName: string
  title: string
  category: string
  identity: string
  target: string
  occurredAt: string
  plannedAt: string
  status: string
  result: string
  operator: string
  workLog: string[]
}

export type PlotMedia = {
  id: string
  name: string
  kind: 'image' | 'video'
  size: number
  url: string
  uploadedAt: string
}

export type PlotPurchase = {
  id: string
  buyer: string
  purchasedAt: string
  product: string
  quantity: string
  status: string
}

export type MemberRemediation = {
  issue: string
  measures: string[]
  owner: string
  dueAt: string
  status: string
  beforeCompletion: string
  currentCompletion: string
  effect: string
  reviewedAt: string
}

export type MemberPerformance = {
  activities: MemberActivity[]
  remediation: MemberRemediation
}
