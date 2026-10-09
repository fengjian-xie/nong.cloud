// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomeSite from './HomeSite'
afterEach(() => { cleanup(); localStorage.clear() })
it('官网新闻可筛选、阅读全文，页脚三个账号入口无伪造链接', () => {
  render(<MemoryRouter initialEntries={['/home-preview']}><HomeSite/></MemoryRouter>)
  const news = screen.getByRole('heading', { name: '乡桥新闻与动态。' }).closest('section')!
  expect(within(news).queryByText('福安葡萄试点建设思路（待审核示例）')).toBeNull()
  fireEvent.click(within(news).getByRole('button', { name: '服务公告' }))
  expect(within(news).getByRole('heading', { name: '农户免平台服务费，农事卡按张收费' })).toBeTruthy()
  expect(within(news).queryByRole('heading', { name: '帮助中心筹备：让种植户与消费者找到支持' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '阅读全文：农户免平台服务费，农事卡按张收费' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  for (const platform of ['视频号', '抖音', '小红书']) expect(screen.getByRole('button', { name: `${platform}：官方账号待配置` }).hasAttribute('disabled')).toBe(true)
})
