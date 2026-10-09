export const categories = ['农事卡与同步', '账号与代办', '农事服务与验收', '土壤与种植问题', '收购与库存', '农场认购与售后', '其他问题与投诉'] as const
export const teams = ['待分派', '中心客服', '卡片与数据协助', '农技与检测协助', '服务履约复核', '产销与仓储协助', '消费者售后'] as const
export const methods = ['站内答复', '电话回访意向（待接入）'] as const
export const statuses = ['待受理', '处理中', '待用户确认', '已关闭'] as const
export type TicketStatus = typeof statuses[number]
export type SupportIdentity = { accountId: string; identityId: string; label: string }
export type SupportTicket = {
  id: string; owner: SupportIdentity; category: typeof categories[number]; method: typeof methods[number]
  description: string; status: TicketStatus; team: typeof teams[number]; reply: string; timeline: string[]
}
export const faqs = [
  { title: '卡片没有网络，记录会丢吗？', answer: '目标方案为离线保存、手机蓝牙读取、服务器持久化后回执。当前没有真实硬件同步；办卡和补卡均100元。' },
  { title: '既种地又提供农服，需要两个账号吗？', answer: '一次登录后切换已批准的主体与身份。添加角色、家庭代办分别审核；换身份不能验收自己的服务。' },
  { title: '作业、验收或收购发生争议怎么办？', answer: '关联地块、工单或批次，保留必要证据，交由有权限的人员独立复核。客服受理不等于验收通过、修改库存或退款。' },
  { title: '土壤或种植问题能找谁？', answer: '帮助中心转交农技人员或检测机构，结合实际资料确认；客服不自动开具施肥或用药方案。' },
  { title: '云农场镜头、配送或品质问题怎么办？', answer: '关联农场或真实订单申请跟进。目前资料照片非直播，演示意向不形成合同，质量、减产、交付和退款各自处理。' },
  { title: '寻求帮助需要收费吗？', answer: '种植户和消费者不收平台帮助服务费；卡片、商品、实际农资和农服费用另行明确。' },
]
export function validDescription(value: string) {
  return value.trim().length >= 8 && value.trim().length <= 1000 && !/1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value)
}
export function createTicket(owner: SupportIdentity, category: string, method: string, description: string, count: number): SupportTicket {
  if (!owner.accountId || !owner.identityId || !categories.some(c => c === category) || !methods.some(m => m === method) || !validDescription(description)) throw new Error('请选择问题类型并填写8–1000字测试说明，勿填真实电话、邮箱或隐私资料。')
  return { id: `help-local-${Date.now()}-${count}`, owner: { ...owner }, category: category as SupportTicket['category'], method: method as SupportTicket['method'], description: description.trim(), status: '待受理', team: '待分派', reply: '', timeline: ['本地登记 · 未提交真实中心'] }
}
export function sameOwner(ticket: SupportTicket, owner: SupportIdentity) { return ticket.owner.accountId === owner.accountId && ticket.owner.identityId === owner.identityId }
type Action = { type: 'assign'; team: string } | { type: 'reply'; text: string } | { type: 'confirm' | 'reopen'; owner: SupportIdentity }
export function transition(ticket: SupportTicket, action: Action): SupportTicket {
  if (action.type === 'assign') {
    if (!teams.some(t => t === action.team) || action.team === '待分派' || !['待受理', '处理中'].includes(ticket.status)) throw new Error('只可将待受理或处理中问题分派到有效队列。')
    return { ...ticket, status: '处理中', team: action.team as SupportTicket['team'], timeline: [...ticket.timeline, `演示分派：${action.team}`] }
  }
  if (action.type === 'reply') {
    if (ticket.status !== '处理中' || !validDescription(action.text)) throw new Error('先分派受理，再填写8–1000字不含真实隐私的处理说明。')
    return { ...ticket, status: '待用户确认', reply: action.text.trim(), timeline: [...ticket.timeline, '演示回复 · 待用户确认是否解决'] }
  }
  if (!sameOwner(ticket, action.owner)) throw new Error('只能处理当前账号及身份自己的问题。')
  if (action.type === 'confirm' && ticket.status === '待用户确认') return { ...ticket, status: '已关闭', timeline: [...ticket.timeline, '演示用户确认解决'] }
  if (action.type === 'reopen' && ['待用户确认', '已关闭'].includes(ticket.status)) return { ...ticket, status: '待受理', team: '待分派', timeline: [...ticket.timeline, '演示用户反馈未解决 · 重新受理'] }
  throw new Error('当前状态不允许此操作。')
}
export function seedQueue(): SupportTicket[] {
  return [
    createTicket({ accountId: 'grower-example', identityId: 'grower-example:farmer', label: '种植户（虚构）' }, categories[0], methods[0], '示例卡片的旧记录同步后，作业类型需要协助核对。', 0),
    createTicket({ accountId: 'consumer-example', identityId: 'consumer-example:consumer', label: '消费者（虚构）' }, categories[5], methods[1], '示例农场的镜头尚未接入，希望了解演示方案边界。', 1),
    createTicket({ accountId: 'team-example', identityId: 'team-example:team', label: '农服队（虚构）' }, categories[2], methods[0], '示例服务完工后有分歧，希望申请独立复核流程。', 2),
  ]
}
export function storageKey(mode: 'user' | 'admin', owner: SupportIdentity) {
  return mode === 'admin' ? 'xiangqiao:support-admin-demo:v1' : `xiangqiao:work-demo:help:${encodeURIComponent(owner.accountId)}:${encodeURIComponent(owner.identityId)}`
}
export function parseTickets(raw: string | null): SupportTicket[] | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as { version?: unknown; tickets?: unknown }
    if (value?.version !== 1 || !Array.isArray(value.tickets) || value.tickets.length > 100) return null
    return value.tickets.filter((t): t is SupportTicket => !!t && typeof t.id === 'string' && typeof t.owner?.accountId === 'string' && typeof t.owner?.identityId === 'string' && typeof t.owner?.label === 'string' && categories.includes(t.category) && methods.includes(t.method) && statuses.includes(t.status) && teams.includes(t.team) && typeof t.description === 'string' && validDescription(t.description) && typeof t.reply === 'string' && Array.isArray(t.timeline) && t.timeline.every((line: unknown) => typeof line === 'string'))
  } catch { return null }
}
