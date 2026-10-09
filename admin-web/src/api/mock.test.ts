import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteSetting, getDashboard, getMemberPerformance, getMemberTask, getModuleRows, getSettingRows, login, saveModuleRow, saveSetting } from './mock'

// Mock latency is not part of the contract under test. Drive it deterministically,
// rather than timing out when the host is asleep or busy running browser checks.
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
async function complete<T>(pending: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync()
  return pending
}

describe('一期Mock契约', () => {
  it('使用统一响应信封登录', async () => {
    const response = await complete(login('13812345678', '000000'))
    expect(response.code).toBe(0)
    expect(response.data.token).toContain('mock-token-fuan')
    expect(response.traceId).toMatch(/^mock-fuan-/)
  })

  it('工作台返回七类指标与五类待办', async () => {
    const response = await complete(getDashboard())
    expect(response.data.metrics).toHaveLength(7)
    expect(response.data.tasks).toHaveLength(5)
  })

  it('工作台今日、本周、自定义时间返回不同统计口径', async () => {
    const [today, week, custom] = await complete(Promise.all([getDashboard({ range: 'today' }), getDashboard({ range: 'week' }), getDashboard({ range: 'custom', dateFrom: '2026-08-10', dateTo: '2026-08-20' })]))
    expect([today.data.periodLabel, week.data.periodLabel, custom.data.periodLabel]).toEqual(['今日', '本周', '2026-08-10 至 2026-08-20'])
    expect(new Set([today.data.metrics[0].value, week.data.metrics[0].value, custom.data.metrics[0].value]).size).toBe(3)
    expect(new Set([today.data.activities[0].title, week.data.activities[0].title, custom.data.activities[0].title]).size).toBe(3)
  })

  it('系统设置支持管理员新增、编辑和删除', async () => {
    const created = await complete(saveSetting('administrators', { id: '', name: '测试管理员', role: '只读', permissions: '会员查看' }))
    expect((await complete(getSettingRows('administrators'))).data.some((item) => item.id === created.data.id)).toBe(true)
    const updated = await complete(saveSetting('administrators', { ...created.data, permissions: '会员查看、地块查看' }))
    expect(updated.data.permissions).toBe('会员查看、地块查看')
    await complete(deleteSetting('administrators', String(created.data.id)))
    expect((await complete(getSettingRows('administrators'))).data.some((item) => item.id === created.data.id)).toBe(false)
  })

  it('会员任务完成度由任务数量自动计算', async () => {
    const member = (await complete(getModuleRows('members'))).data[0]
    const updated = await complete(saveModuleRow('members', { ...member, assignedTasks: 20, completedTasks: 15, taskCompletion: '1%' }))
    expect(updated.data.taskCompletion).toBe('75%')
  })

  it('会员详情返回活动时间线和个性化补救效果', async () => {
    const response = await complete(getMemberPerformance('MB20260829001'))
    expect(response.data.activities[0].occurredAt).toBeTruthy()
    expect(response.data.remediation.measures.length).toBeGreaterThan(0)
    expect(response.data.remediation.effect).toContain('提升')
  })

  it('时间线活动可读取对应的具体任务', async () => {
    const performance = await complete(getMemberPerformance('MB20260829001'))
    const task = await complete(getMemberTask(performance.data.activities[0].taskId))
    expect(task.data.memberId).toBe('MB20260829001')
    expect(task.data.workLog.length).toBeGreaterThan(1)
  })
})
