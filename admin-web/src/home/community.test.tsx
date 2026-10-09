// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CardSection } from './CardSection'
import { MembersSection } from './MembersSection'
import { StandardsSection } from './StandardsSection'
import { members, cardScenarios } from './community'
import { acceptanceTemplate, applicationChecklist, fullStandardsText, roleStandards, stageStandards } from './standards'
import { downloadText } from './download'
import { farmerFeePolicy, recordCardPrices } from '../pricing'

vi.mock('./download', () => ({ downloadText: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('官网农事卡、筹建成员与执行标准', () => {
  it('农户免平台服务费，办卡与补卡均为100元，页面和下载清单一致', () => {
    expect(recordCardPrices).toEqual({ issue: 100, replacement: 100 })
    render(<CardSection/>)
    expect(screen.getByText(farmerFeePolicy)).toBeTruthy()
    expect(fullStandardsText()).toContain(farmerFeePolicy)
    expect(applicationChecklist(['grower', 'service'], '福安市')).toContain(farmerFeePolicy)
  })
  it('单排五键示意与四个应用场景支持键盘切换', () => {
    render(<CardSection/>)
    expect(screen.getByRole('img').getAttribute('alt')).toContain('单排五键')
    expect(screen.getByText(/非已量产设备/)).toBeTruthy()
    const tabs = within(screen.getByRole('tablist', { name: '农事卡应用场景' })).getAllByRole('tab')
    for (let index = 0; index < tabs.length; index++) {
      fireEvent.click(tabs[index])
      expect(screen.getByText(cardScenarios[index].description)).toBeTruthy()
    }
    fireEvent.keyDown(tabs[3], { key: 'Home' })
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tabs[0])
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' })
    expect(tabs[3].getAttribute('aria-selected')).toBe('true')
  })
  it('保留12条有效筹建记录，不推断空缺，不公开称号背书', () => {
    expect(members).toHaveLength(12)
    render(<MembersSection/>)
    expect(screen.getByText(/名单不代表已通过准入/)).toBeTruthy()
    expect(screen.getByText('谢逢建')).toBeTruthy()
    const tabs = within(screen.getByRole('tablist', { name: '农事中心成员分组' })).getAllByRole('tab')
    fireEvent.click(tabs[2])
    expect(screen.getByText('林（姓名待补充）')).toBeTruthy()
    expect(screen.getAllByText(/资料标注，待核验/)).toHaveLength(2)
    fireEvent.click(tabs[3])
    expect(screen.getAllByText('负责人待补充')).toHaveLength(3)
    expect(screen.queryByText(/政协委员|创业导师/)).toBeNull()
    expect(document.body.textContent).not.toMatch(/1[3-9]\d{9}/)
  })
  it('多身份只本地生成清单，不伪装后端受理', () => {
    render(<MembersSection/>)
    fireEvent.click(screen.getByRole('checkbox', { name: '农服队' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '植保与无人机' }))
    fireEvent.click(screen.getByRole('button', { name: '生成申请清单' }))
    expect(screen.getByRole('status').textContent).toContain('尚未提交到农事中心')
    fireEvent.click(screen.getByRole('button', { name: '下载申请清单' }))
    expect(vi.mocked(downloadText).mock.calls[0][1]).toContain('无人机手与调度')
    expect(vi.mocked(downloadText).mock.calls[0][1]).toContain('种植户')
    expect(vi.mocked(downloadText).mock.calls[0][1]).toContain(farmerFeePolicy)
    expect(vi.mocked(downloadText).mock.calls[0][1]).not.toContain('\n合作社\n')
    fireEvent.change(screen.getByLabelText('计划服务区域'), { target: { value: '宁德市其他县域' } })
    expect(screen.queryByRole('button', { name: '下载申请清单' })).toBeNull()
  })
  it('不选身份不能生成，也不采集证件或手机号', () => {
    render(<MembersSection/>)
    fireEvent.click(screen.getByRole('checkbox', { name: '种植户' }))
    fireEvent.click(screen.getByRole('button', { name: '生成申请清单' }))
    expect(screen.getByRole('status').textContent).toContain('请至少选择一种身份')
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(vi.mocked(downloadText)).not.toHaveBeenCalled()
  })
  it('14类角色和12个环节各有独立标准及责任人', () => {
    expect(roleStandards).toHaveLength(14)
    expect(stageStandards).toHaveLength(12)
    render(<StandardsSection/>)
    expect(screen.getByText(/平台草案不是国家标准/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('查看角色标准'), { target: { value: 'inputs' } })
    expect(screen.getByRole('heading', { name: '农资商准入' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '角色执行' }))
    expect(screen.getByText('购买方或授权代办验收；中心核验资质和异常供货记录。')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '环节验收' }))
    fireEvent.change(screen.getByLabelText('查看环节标准'), { target: { value: 'delivery' } })
    expect(screen.getByRole('heading', { name: '消费者签收与售后' })).toBeTruthy()
    expect(screen.getByText(/不能一律以生鲜为由/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /下载完整标准草案/ }))
    fireEvent.click(screen.getByRole('button', { name: /下载验收记录模板/ }))
    expect(vi.mocked(downloadText)).toHaveBeenNthCalledWith(2, '乡桥通用验收记录模板-草案v0.1.txt', acceptanceTemplate)
  })
  it('完整下载包含所有角色、环节、来源与纠错规则', () => {
    const text = fullStandardsText()
    for (const role of roleStandards) expect(text).toContain(role.name)
    for (const stage of stageStandards) expect(text).toContain(stage.name)
    expect(text).toContain('不覆盖原始事件')
    expect(text).toContain('成本＋35%只是用户可调')
    expect(text).toContain('https://www.caac.gov.cn/')
    expect(applicationChecklist(['grower'], '福安市')).toContain('尚未提交申请')
  })
})
