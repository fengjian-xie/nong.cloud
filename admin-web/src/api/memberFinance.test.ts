import { describe, expect, it } from 'vitest'
import { createMemberTransactions } from './memberFinance'
import { getModuleRows } from './mock'

describe('会员收支模拟流水', () => {
  it('每位演示会员至少20条，编号唯一且只关联本人，收支分毫相符', async () => {
    const { data: members } = await getModuleRows('members')
    const ids = new Set<string>()
    for (const member of members) {
      const rows = createMemberTransactions(member)
      expect(rows.length).toBeGreaterThanOrEqual(20)
      expect(rows.every((row) => row.memberId === String(member.id))).toBe(true)
      expect(rows.filter((row) => row.direction === 'income').reduce((sum, row) => sum + row.amountCents, 0)).toBe(Math.round(Number(member.incomeAmount) * 100))
      expect(rows.filter((row) => row.direction === 'expense').reduce((sum, row) => sum + row.amountCents, 0)).toBe(Math.round(Number(member.expenseAmount) * 100))
      for (const row of rows) { expect(ids.has(row.id)).toBe(false); ids.add(row.id) }
      expect(createMemberTransactions(member)).toEqual(rows)
    }
  })

  it('零金额不编造交易，少量金额保持精确', () => {
    const empty = { id: 'zero', incomeAmount: 0, expenseAmount: 0 }
    expect(createMemberTransactions(empty)).toEqual([])
    const rows = createMemberTransactions({ ...empty, incomeAmount: 0.03, expenseAmount: 1.01 })
    expect(rows.every((row) => Number.isInteger(row.amountCents) && row.amountCents > 0)).toBe(true)
    expect(rows.filter((row) => row.direction === 'income').reduce((sum, row) => sum + row.amountCents, 0)).toBe(3)
    expect(rows.filter((row) => row.direction === 'expense').reduce((sum, row) => sum + row.amountCents, 0)).toBe(101)
  })
})
