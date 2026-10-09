// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RootApp } from '../app/RootApp'
import { businesses, homeTitle, isHomePreviewPath, isHomeSiteHost } from './site'

vi.mock('../app/AdminApp', () => ({ default: () => <div>管理员登录与后台</div> }))
afterEach(() => { cleanup(); vi.unstubAllEnvs() })
const setup = (hostname = 'nong.cloud', path = '/') => render(<MemoryRouter initialEntries={[path]}><RootApp hostname={hostname}/></MemoryRouter>)

describe('乡桥品牌官网', () => {
  it('域名与预览路径精确匹配', () => {
    expect(isHomeSiteHost('NONG.CLOUD.')).toBe(true)
    expect(isHomeSiteHost('www.nong.cloud')).toBe(true)
    for (const host of ['m.nong.cloud', 'api.nong.cloud', 'nong.cloud:443', 'nong.cloud.attacker.test']) expect(isHomeSiteHost(host)).toBe(false)
    expect(isHomePreviewPath('/home-preview')).toBe(true)
    expect(isHomePreviewPath('/home-preview/deeper')).toBe(true)
    expect(isHomePreviewPath('/home-previews')).toBe(false)
  })
  it('品牌首页无需后台会话且明确公司、费用和规划', async () => {
    setup()
    expect(await screen.findByRole('heading', { level: 1, name: /让农事有记录/ })).toBeTruthy()
    await waitFor(() => expect(document.title).toBe(homeTitle))
    expect(screen.getByRole('heading', { name: '乡桥农业有限公司' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '福安市乡桥农事综合服务有限公司' })).toBeTruthy()
    expect(screen.getByText(/计划覆盖福安葡萄500亩/)).toBeTruthy()
    expect(screen.getByText(/不代表已完成覆盖或获得认证/)).toBeTruthy()
    expect(screen.getByText(/不出售个人隐私/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: '农户免平台服务费，农事卡按张收费。' })).toBeTruthy()
    expect(screen.getAllByText(/办卡100元\/张，补卡100元\/张/).length).toBeGreaterThanOrEqual(3)
    expect(document.body.textContent).not.toMatch(/生产端免费|生产端不收费/)
    expect(screen.getByText(/该体系不替代绿色食品等法定认证/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /下载完整模块方案/ }).getAttribute('href')).toContain('/brand/xiangqiao-modules-20261005.txt')
    expect(screen.getByRole('link', { name: /下载项目支持与补贴清单/ }).getAttribute('href')).toContain('/brand/xiangqiao-project-support-20261005.txt')
    expect(screen.getByText(/本网站不受理政府项目申报/)).toBeTruthy()
    expect(screen.queryByText('管理员登录与后台')).toBeNull()
    expect(screen.getAllByRole('img').filter(img => img.getAttribute('src')?.includes('/brand/')).length).toBeGreaterThanOrEqual(7)
  })
  it('四个业务切换真实内容，并支持键盘切换', async () => {
    setup()
    const tabs = within(await screen.findByRole('tablist', { name: '乡桥业务' })).getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    for (let index = 0; index < businesses.length; index++) {
      fireEvent.click(tabs[index])
      expect(tabs[index].getAttribute('aria-selected')).toBe('true')
      expect(screen.getByRole('tabpanel', { name: new RegExp(businesses[index].name) }).getAttribute('aria-labelledby')).toBe(`business-tab-${index}`)
      expect(screen.getByRole('heading', { name: businesses[index].title })).toBeTruthy()
    }
    fireEvent.keyDown(tabs[3], { key: 'Home' })
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tabs[0])
    fireEvent.keyDown(tabs[0], { key: 'ArrowDown' })
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
  })
  it('官网集中展示五个约定入口，已上线农场直接可达', async () => {
    setup()
    expect(await screen.findByRole('heading', { name: '从这里，进入乡桥。' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '进入后台演示' }).getAttribute('href')).toBe('https://m.nong.cloud/')
    expect(screen.getByRole('link', { name: '查看接口文档' }).getAttribute('href')).toBe('https://api.nong.cloud/')
    expect(screen.getByRole('link', { name: '进入用户工作台' }).getAttribute('href')).toBe('https://work.nong.cloud/')
    expect(screen.getByRole('link', { name: '进入乡桥农场' }).getAttribute('href')).toBe('https://nc.nong.cloud/')
    for (const name of ['进入后台演示', '查看接口文档', '进入用户工作台', '进入乡桥农场']) {
      const entry = screen.getByRole('link', { name })
      expect(entry.getAttribute('target')).toBe('_blank')
      expect(entry.getAttribute('rel')).toBe('noopener noreferrer')
    }
    expect(screen.getByRole('link', { name: '了解乡桥业务体系' }).getAttribute('target')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /乡桥云农场/ }))
    expect(screen.getByRole('heading', { name: '相隔千里，也能看见生长。' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /采购与库存共享/ }))
    expect(screen.getByRole('heading', { name: '好产品，遇见合适的采购商。' })).toBeTruthy()
  })
  it('手机导航可打开和关闭，预览锚点不跳回后台', async () => {
    setup('localhost', '/home-preview')
    const menu = await screen.findByRole('button', { name: '打开导航' })
    fireEvent.click(menu)
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getAllByRole('link', { name: '业务介绍' })[0])
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('link', { name: '了解乡桥业务' }).getAttribute('href')).toBe('#business')
    expect(screen.getByRole('link', { name: '乡桥农事中心首页' }).getAttribute('href')).toBe('/home-preview')
  })
  it('API入口优先，home-site模式与后台隔离', async () => {
    vi.stubEnv('MODE', 'home-site')
    const view = setup('127.0.0.1', '/login')
    expect(await screen.findByRole('heading', { level: 1, name: /让农事有记录/ })).toBeTruthy()
    view.unmount()
    setup('api.nong.cloud')
    expect(await screen.findByRole('heading', { name: 'API开放平台' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1, name: /让农事有记录/ })).toBeNull()
  })
})
