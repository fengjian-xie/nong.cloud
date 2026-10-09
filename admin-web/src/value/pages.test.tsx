// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { FarmProvider } from '../farm/FarmProvider'
import PortalApp from '../portals/PortalApp'
import PublicProducts from './PublicProducts'
import { ProductValueSection } from '../home/ProductValueSection'
afterEach(() => { cleanup(); localStorage.clear() })
const setup = (module: string, role = 'farmer') => render(<MemoryRouter initialEntries={[`/workspace/${role}/value-${module}`]}><FarmProvider><Routes><Route path="/workspace/:role/*" element={<PortalApp/>}/></Routes></FarmProvider></MemoryRouter>)
it('生产身份预览公开摘要，隐藏私人设备与成本', async () => {
  setup('passport'); fireEvent.click(await screen.findByRole('button', { name: '预览公开摘要' }))
  const dialog = within(screen.getByRole('dialog', { name: '产品公开摘要预览' }))
  expect(dialog.getByText('暂无适用的真实产品检测报告')).toBeTruthy()
  expect(dialog.queryByText('林春梅')).toBeNull()
  expect(dialog.queryByText('XQ-C0001')).toBeNull()
  fireEvent.click(dialog.getByRole('button', { name: '关闭窗口' }))
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '保存履历草稿' }))
  fireEvent.click(screen.getByRole('button', { name: '提交独立审核' }))
  expect((screen.getByRole('button', { name: '独立审核演示' }) as HTMLButtonElement).disabled).toBe(true)
})
it('记录生成后仍需媒体确认，保存后只在草稿列表', async () => {
  setup('stories'); fireEvent.click(await screen.findByRole('button', { name: '整理本季记录摘要' }))
  expect((screen.getByLabelText('产季说明与备注') as HTMLTextAreaElement).value).toContain('核验记录')
  fireEvent.click(screen.getByRole('button', { name: '保存待本人确认草稿' }))
  expect(screen.getByRole('alert').textContent).toContain('媒体授权')
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '保存待本人确认草稿' }))
  expect(screen.getByText('待本人确认草稿')).toBeTruthy()
})
it('子女默认不能生成记录，采购商不能直接打开经营账', async () => {
  const page = setup('stories', 'family')
  expect(await screen.findByRole('heading', { name: '尚无产季记录整理授权' })).toBeTruthy()
  page.unmount(); setup('income', 'buyer')
  expect(await screen.findByText('此角色没有该业务入口')).toBeTruthy()
  expect(screen.queryByLabelText('销售收入 / 元')).toBeNull()
})
it('经营账测算正负收益并留在当前账号', async () => {
  setup('income'); await screen.findByLabelText('销售收入 / 元')
  fireEvent.change(screen.getByLabelText('销售收入 / 元'), { target: { value: '5000' } })
  fireEvent.change(screen.getByLabelText('对应产品数量 / kg'), { target: { value: '1000' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并测算净收益' }))
  expect(screen.getByText('现金净收益测算')).toBeTruthy()
  expect(screen.getAllByText('¥4900.00')).toHaveLength(2)
})
it('分级匹配单位转换正确，保存意向不锁库存', async () => {
  setup('grades', 'buyer'); fireEvent.click(await screen.findByRole('button', { name: '匹配共享货源示例' }))
  expect(screen.getByRole('heading', { name: '匹配 1 批 · 需求 1000 kg' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('用途、需要时间与质量要求'), { target: { value: '测试加工补货，需要核对质量与交接' } })
  fireEvent.click(screen.getByRole('button', { name: '保存分级需求草稿' }))
  expect(screen.getByText('本地分级需求 · 未发送')).toBeTruthy()
})
it('公开消费者页不读取私有缓存，关注与反馈不形成真实订单', () => {
  localStorage.setItem('xiangqiao:work-demo:value:private', JSON.stringify({ privateCost: 'DO_NOT_SHOW_PRIVATE' }))
  render(<MemoryRouter><PublicProducts helpPath="/help"/></MemoryRouter>)
  expect(screen.queryByText('DO_NOT_SHOW_PRIVATE')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '采收预告' }))
  fireEvent.click(screen.getByRole('button', { name: '关注采收预告示例' }))
  expect(screen.getByRole('status').textContent).toContain('未发送提醒')
  fireEvent.click(screen.getByRole('button', { name: '交付反馈' }))
  fireEvent.change(screen.getByLabelText('批次与交付情况（仅测试）'), { target: { value: '测试产品数量与交付说明' } })
  fireEvent.click(screen.getByRole('button', { name: '保存本页反馈草稿' }))
  expect(screen.getByRole('status').textContent).toContain('不自动退款')
})
it('同账号切换工作身份，不带出另一个身份的反馈文本', async () => {
  setup('feedback', 'cooperative')
  await screen.findByLabelText('问题说明（仅测试）')
  fireEvent.change(screen.getByLabelText('问题说明（仅测试）'), { target: { value: '合作社身份的内部反馈测试说明' } })
  fireEvent.click(screen.getByRole('button', { name: '保存本地帮助登记' }))
  expect(screen.getByText('合作社身份的内部反馈测试说明')).toBeTruthy()
  fireEvent.click(screen.getByRole('combobox', { name: '切换演示角色' }))
  fireEvent.click(screen.getByRole('option', { name: '采购商' }))
  fireEvent.click(within(screen.getByRole('navigation', { name: '角色业务导航' })).getByRole('link', { name: '履约反馈' }))
  await screen.findByLabelText('问题说明（仅测试）')
  expect(screen.queryByText('合作社身份的内部反馈测试说明')).toBeNull()
})
it('官网展示六类价值且新页面入口保留安全属性', () => {
  render(<ProductValueSection preview/>)
  expect(screen.getByRole('heading', { name: '一批产品，一份履历' })).toBeTruthy()
  const link = screen.getByRole('link', { name: '查看产品履历原型' })
  expect(link.getAttribute('href')).toBe('/cloud-preview?view=products')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
})
