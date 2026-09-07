import type { MemberActivity, OperationRow } from '../types'

export type TransactionDirection = 'income' | 'expense'
export type PaymentChannel = '微信支付'
export type MemberTransaction = {
  id: string
  memberId: string
  occurredAt: string
  direction: TransactionDirection
  business: string
  counterparty: string
  amountCents: number
  channel: PaymentChannel
  status: '已入账'
}

// Demo-only ledger: distribute the existing member totals in integer cents.
// This is not a payment-provider response and never initiates a real payment.
export function createMemberTransactions(member: OperationRow): MemberTransaction[] {
  const memberId = String(member.id)
  const seed = [...memberId].reduce((sum, letter) => sum + letter.charCodeAt(0), 0)
  const transactions: MemberTransaction[] = []
  for (const direction of ['income', 'expense'] as const) {
    const value = Number(member[direction === 'income' ? 'incomeAmount' : 'expenseAmount'])
    const totalCents = Number.isFinite(value) ? Math.max(0, Math.round(value * 100)) : 0
    const weights = Array.from({ length: 12 }, (_, index) => 2 + (seed + index * 3) % 7)
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    let allocated = 0
    weights.forEach((weight, index) => {
      const amountCents = index === weights.length - 1 ? totalCents - allocated : Math.floor(totalCents * weight / totalWeight)
      allocated += amountCents
      if (!amountCents) return
      const sequence = index * 2 + (direction === 'income' ? 0 : 1)
      const identities = String(member.identities || '')
      const incomeBusiness = identities.includes('服务商') ? '农事服务结算' : identities.includes('供应商') ? '农资供货结算' : '农产品销售货款'
      transactions.push({
        id: `TX-${memberId}-${String(sequence + 1).padStart(3, '0')}`,
        memberId,
        occurredAt: `2026-08-${String(29 - sequence).padStart(2, '0')} ${String(9 + index % 8).padStart(2, '0')}:${index % 2 ? '30' : '15'}`,
        direction,
        business: direction === 'income' ? incomeBusiness : ['农事服务费用', '农资采购费用', '分拣打包费用'][index % 3],
        counterparty: direction === 'income' ? ['福安分拣车间', '闽东农产品采购中心', '福安鲜果合作社'][index % 3] : ['绿田农服', '福安禾盛农服', '溪柄农资经营部'][index % 3],
        amountCents,
        channel: '微信支付',
        status: '已入账',
      })
    })
  }
  return transactions.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

export const formatTransactionAmount = (cents: number) => `¥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export type MemberLedgerRecord = Omit<MemberTransaction, 'direction' | 'amountCents' | 'channel' | 'status'> & {
  direction: TransactionDirection | 'activity'
  amountCents: number | null
  channel: PaymentChannel | '—'
  status: string
  taskId?: string
  result?: string
  identity?: string
}

export function createMemberLedger(member: OperationRow, activities: MemberActivity[] = []): MemberLedgerRecord[] {
  // No inferred payment/task associations: non-financial activities carry no amount.
  const records: MemberLedgerRecord[] = createMemberTransactions(member)
  const uniqueActivities = new Map(activities.map((activity) => [activity.id, activity]))
  for (const activity of uniqueActivities.values()) {
    records.push({
      id: `ACT-${activity.id}`,
      memberId: String(member.id),
      occurredAt: activity.occurredAt,
      direction: 'activity',
      business: activity.action,
      counterparty: activity.target,
      amountCents: null,
      channel: '—',
      status: '已记录',
      taskId: activity.taskId,
      result: activity.result,
      identity: activity.identity,
    })
  }
  return records.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}
