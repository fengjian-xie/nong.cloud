// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemberFinanceLedger } from './MemberFinanceLedger'
import { MemoryRouter } from 'react-router-dom'
import type { MemberActivity } from '../types'

const member = { id: 'MB20260829001', incomeAmount: 35820, expenseAmount: 12680, identities: '种植户、采购商' }
const records = () => within(screen.getByRole('list', { name: '业务活动与收支时间线' })).getAllByRole('listitem')
afterEach(cleanup)

describe('会员收支列表交互', () => {
  it('业务活动只出现一次，保留任务链接与结果，不编造收支金额', () => {
    const activity: MemberActivity = { id: 'activity-1', taskId: 'task-1', occurredAt: '2026-08-29 10:00', action: '完成巡查', target: '水稻田1号', identity: '种植户', result: '按时完成，验收通过', tone: 'positive' }
    render(<MemoryRouter><MemberFinanceLedger member={member} activities={[activity, activity]} /></MemoryRouter>)
    expect(screen.getByText('共 25 条记录')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: '完成巡查' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: '完成巡查' }).getAttribute('href')).toBe('/tasks/task-1?from=%2Fmembers%2FMB20260829001')
    fireEvent.change(screen.getByLabelText('记录类型'), { target: { value: 'activity' } })
    expect(records()).toHaveLength(1)
    expect(records()[0].querySelector('.finance-amount')?.textContent).toBe('—')
    expect(records()[0].textContent).toContain('按时完成，验收通过')
    expect(screen.queryByLabelText('支付方式')).toBeNull()
  })
  it('默认20条，下一页不显示序号，每页选项与全站一致', () => {
    render(<MemberFinanceLedger member={member} />)
    expect(records()).toHaveLength(20)
    expect(within(screen.getByLabelText('每页条数')).getAllByRole('option').map((option) => option.getAttribute('value'))).toEqual(['20', '50', '100', '200'])
    fireEvent.click(screen.getByLabelText('下一页'))
    expect(records()).toHaveLength(4)
    expect(records()[0].querySelector('.ledger-sequence')).toBeNull()
    fireEvent.change(screen.getByLabelText('每页条数'), { target: { value: '50' } })
    expect(records()).toHaveLength(24)
  })

  it('收支类型筛选、搜索空态和图标重置可用', () => {
    render(<MemberFinanceLedger member={member} />)
    fireEvent.click(screen.getByLabelText('下一页'))
    fireEvent.change(screen.getByLabelText('记录类型'), { target: { value: 'income' } })
    expect(records()).toHaveLength(12)
    expect(records().every((row) => row.textContent?.includes('收入') && row.textContent?.includes('微信支付'))).toBe(true)
    fireEvent.change(screen.getByLabelText('搜索收支明细'), { target: { value: '不存在的交易' } })
    expect(screen.getByText('没有匹配的记录')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('重置收支筛选'))
    expect(records()).toHaveLength(20)
  })

  it('金额支持升降序，不重复显示合计金额', () => {
    render(<MemberFinanceLedger member={member} />)
    expect(screen.queryByText(/筛选合计/)).toBeNull()
    expect(screen.getByText('共 24 条记录')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('记录排序'), { target: { value: 'amountCents-desc' } })
    expect((screen.getByLabelText('记录排序') as HTMLSelectElement).value).toBe('amountCents-desc')
    fireEvent.change(screen.getByLabelText('记录排序'), { target: { value: 'amountCents-asc' } })
    expect((screen.getByLabelText('记录排序') as HTMLSelectElement).value).toBe('amountCents-asc')
  })

  it('时间范围包含起止当天，可与其他条件组合且重置清空', () => {
    render(<MemberFinanceLedger member={member} />)
    fireEvent.click(screen.getByLabelText('下一页'))
    fireEvent.change(screen.getByLabelText('收支开始日期'), { target: { value: '2026-08-25' } })
    fireEvent.change(screen.getByLabelText('收支结束日期'), { target: { value: '2026-08-29' } })
    expect(records()).toHaveLength(5)
    expect(records()[0].querySelector('.ledger-sequence')).toBeNull()
    fireEvent.change(screen.getByLabelText('记录类型'), { target: { value: 'income' } })
    expect(records()).toHaveLength(3)
    expect(records()[0].textContent).toContain('2026-08-29')
    fireEvent.click(screen.getByLabelText('重置收支筛选'))
    expect((screen.getByLabelText('收支开始日期') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('收支结束日期') as HTMLInputElement).value).toBe('')
    expect(records()).toHaveLength(20)
  })

  it('支持单边日期和同一天，反向日期给出提示', () => {
    render(<MemberFinanceLedger member={member} />)
    fireEvent.change(screen.getByLabelText('收支结束日期'), { target: { value: '2026-08-07' } })
    expect(records()).toHaveLength(2)
    fireEvent.change(screen.getByLabelText('收支开始日期'), { target: { value: '2026-08-07' } })
    expect(records()).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('收支开始日期'), { target: { value: '2026-08-08' } })
    expect(screen.getByRole('alert').textContent).toContain('开始日期不能晚于结束日期')
    fireEvent.click(screen.getByLabelText('重置收支筛选'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
