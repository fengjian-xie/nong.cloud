// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SystemManagementPage from './SystemManagementPage'
import { NewsSection } from '../home/NewsSection'
import { SocialLinks } from '../home/SocialLinks'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: 'admin-fuan-001', name: '陈晓岚', role: '县域运营管理员' } } }) }))
vi.mock('../home/download', () => ({ downloadText: vi.fn() }))
beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const setup = (view: Parameters<typeof SystemManagementPage>[0]['view']) => render(<MemoryRouter><SystemManagementPage view={view}/></MemoryRouter>)

it('日志筛选、详情、空态与脱敏导出可用', () => {
  setup('logs')
  fireEvent.change(screen.getByLabelText('日志类别'), { target: { value: '安全告警' } })
  expect(screen.getByText('自身提权被阻止')).toBeTruthy()
  expect(screen.queryByText('载入演示配置')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '查看日志' }))
  expect(screen.getByRole('dialog', { name: '日志详情' })).toBeTruthy()
  expect(screen.getByText('demo-denied')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '关闭窗口' }))
  fireEvent.change(screen.getByLabelText('搜索操作、对象、操作者或追踪ID'), { target: { value: '不存在的内容' } })
  expect(screen.getByText('没有匹配的数据，请调整筛选条件')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '重置筛选' }))
  fireEvent.click(screen.getByRole('button', { name: '导出演示CSV' }))
  expect(screen.getByRole('status').textContent).toContain('脱敏示例字段')
})
it('接口配置与本地检查有留痕，不收集真实密钥', () => {
  const view = setup('integrations')
  const card = screen.getByRole('heading', { name: '一品一码 / 追溯平台' }).closest('article')!
  fireEvent.click(within(card).getByRole('button', { name: '配置接口' }))
  fireEvent.change(screen.getByLabelText('HTTPS接口地址（仅演示）'), { target: { value: 'https://provider.example.invalid/api' } })
  fireEvent.click(screen.getByRole('button', { name: '保存本地配置' }))
  expect(screen.getByText('本地已配置')).toBeTruthy()
  fireEvent.click(within(card).getByRole('button', { name: '接入说明' }))
  fireEvent.click(screen.getByRole('button', { name: '本地格式检查' }))
  expect(screen.getByRole('status').textContent).toContain('未发起连接或上传')
  view.unmount(); setup('logs')
  expect(screen.getByText('本地格式检查通过')).toBeTruthy()
})
it('管理员自己不能改权限，独立审批更新示例版本', () => {
  setup('permissions')
  const current = screen.getByText('当前账号 · 不可自行修改').closest('tr')!
  expect(within(current).getByRole('button', { name: '调整权限' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '审批演示申请' }))
  expect(screen.getByText('林客服（示例） · 演示已通过')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('未修改真实账号')
})
it('新闻草稿不公开，自己的审核按钮禁用，其他编辑稿可演示发布', () => {
  const view = setup('news')
  fireEvent.click(screen.getByRole('button', { name: '新增新闻' }))
  fireEvent.change(screen.getByLabelText('新闻标题'), { target: { value: '测试草稿独立审核' } })
  fireEvent.change(screen.getByLabelText('新闻摘要'), { target: { value: '测试草稿摘要，不在官网直接出现。' } })
  fireEvent.change(screen.getByLabelText('新闻正文（纯文本）'), { target: { value: '这是用于验证独立审核与公开列表隔离的新闻测试正文，不代表实际业务。' } })
  fireEvent.click(screen.getByRole('button', { name: '保存新闻草稿' }))
  const row = screen.getByText('测试草稿独立审核').closest('tr')!
  fireEvent.click(within(row).getByRole('button', { name: '提交审核' }))
  expect(within(row).getByRole('button', { name: '审核演示发布' }).hasAttribute('disabled')).toBe(true)
  const other = screen.getByText('福安葡萄试点建设思路（待审核示例）').closest('tr')!
  fireEvent.click(within(other).getByRole('button', { name: '审核演示发布' }))
  view.unmount(); render(<NewsSection preview/>)
  expect(screen.queryByText('测试草稿独立审核')).toBeNull()
  expect(screen.getByRole('heading', { name: '福安葡萄试点建设思路（待审核示例）' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '阅读全文：福安葡萄试点建设思路（待审核示例）' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
})
it('社交配置联动本机分中心预览，不修改平台总入口', () => {
  const view = setup('social')
  fireEvent.change(screen.getByLabelText('账号名称（抖音）'), { target: { value: '测试中心账号' } })
  fireEvent.change(screen.getByLabelText('官方主页链接（抖音）'), { target: { value: 'https://www.douyin.com/user/test-demo' } })
  const card = screen.getByRole('heading', { name: '抖音' }).closest('article')!
  fireEvent.click(within(card).getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '保存抖音本地配置' }))
  fireEvent.change(screen.getByLabelText('配置所属组织'), { target: { value: 'platform' } })
  expect(screen.getByRole('button', { name: '保存抖音本地配置' }).hasAttribute('disabled')).toBe(true)
  view.unmount(); const preview = render(<SocialLinks preview centerId="fuan"/>)
  expect(screen.getByRole('link', { name: '抖音：测试中心账号' }).getAttribute('rel')).toBe('noopener noreferrer')
  preview.unmount(); render(<SocialLinks/>)
  expect(screen.queryByRole('link', { name: '抖音：测试中心账号' })).toBeNull()
  expect(screen.getByRole('button', { name: '抖音：官方账号待配置' }).hasAttribute('disabled')).toBe(true)
})
it('新增区县中心为待审核申请，申请人不能开通或赋权', () => {
  setup('centers')
  fireEvent.click(screen.getByRole('button', { name: '新增区县服务中心申请' }))
  fireEvent.change(screen.getByLabelText('农事服务中心名称'), { target: { value: '测试县农事服务中心' } })
  fireEvent.change(screen.getByLabelText('拟定运营主体名称'), { target: { value: '测试县乡桥农事服务有限公司' } })
  fireEvent.change(screen.getByLabelText('省市区县与拟落地地址（仅测试）'), { target: { value: '测试省测试市测试县测试地址' } })
  fireEvent.click(screen.getByRole('button', { name: '提交中心筹备申请' }))
  const row = screen.getByText('测试县乡桥农事服务有限公司', { selector: 'small' }).closest('tr')!
  expect(within(row).getByText('待平台审核')).toBeTruthy()
  expect(within(row).getByRole('button', { name: '平台审核演示申请' }).hasAttribute('disabled')).toBe(true)
})
it('本地储存被禁用也能打开页面并显示诚实保存提示', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  setup('logs')
  fireEvent.click(screen.getByRole('button', { name: '导出演示CSV' }))
  expect(screen.getByRole('heading', { name: '日志中心', level: 1 })).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('储存不可用')
})
it('切换模块清除上一个操作提示，但保留账号下的操作留痕', () => {
  const page = setup('permissions')
  fireEvent.click(screen.getByRole('button', { name: '审批演示申请' }))
  expect(screen.getByRole('status').textContent).toContain('未修改真实账号')
  page.rerender(<MemoryRouter><SystemManagementPage view="logs"/></MemoryRouter>)
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByText('审核权限演示申请')).toBeTruthy()
})
it('产区业务身份可添加草案，保留共用模板且不进入登录授权', () => {
  setup('identities')
  fireEvent.click(screen.getByRole('button', { name: '新增产区身份草案' }))
  fireEvent.change(screen.getByLabelText('业务身份名称'), { target: { value: '葡萄套袋队（测试）' } })
  fireEvent.change(screen.getByLabelText('产区准入与作业要求'), { target: { value: '核对人员服务能力，作业留证并由独立验收人确认。' } })
  fireEvent.click(screen.getByRole('button', { name: '保存业务身份草案' }))
  expect(screen.getByText('葡萄套袋队（测试）')).toBeTruthy()
  expect(screen.getByText('待发布草案')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('没有授予用户角色')
})
