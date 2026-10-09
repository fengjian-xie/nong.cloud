// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RootApp } from '../app/RootApp'
import { apiSiteEntry, isApiPreviewPath, isApiSiteHost, plannedApiBase } from './site'

vi.mock('../app/AdminApp', () => ({ default: () => <div>管理员登录与后台</div> }))
afterEach(() => { cleanup(); vi.unstubAllEnvs(); localStorage.clear() })
const setup = (hostname: string, path = '/') => render(<MemoryRouter initialEntries={[path]}><RootApp hostname={hostname}/></MemoryRouter>)

describe('独立API域名与入口隔离', () => {
  it('只接受确切域名，不接受相似域名或额外端口', () => {
    expect(isApiSiteHost('api.nong.cloud')).toBe(true); expect(isApiSiteHost('API.NONG.CLOUD.')).toBe(true)
    for (const host of ['m.nong.cloud', 'nong.cloud', 'api.nong.cloud.attacker.test', 'api.nong.cloud:443', 'notapi.nong.cloud']) expect(isApiSiteHost(host)).toBe(false)
    expect(isApiPreviewPath('/api-portal')).toBe(true); expect(isApiPreviewPath('/api-portal/help')).toBe(true); expect(isApiPreviewPath('/api-portals')).toBe(false)
    expect(apiSiteEntry('127.0.0.1')).toBe('/api-portal'); expect(apiSiteEntry('m.nong.cloud')).toBe('https://api.nong.cloud')
    expect(plannedApiBase).toBe('https://api.nong.cloud/open-api/v1')
  })
  it('api域名无需管理员会话且没有后台菜单与用户姓名', async () => {
    setup('api.nong.cloud')
    expect(await screen.findByRole('heading', { name: 'API开放平台' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /乡桥开放平台/ }).getAttribute('href')).toBe('/')
    expect(screen.queryByRole('navigation', { name: '主导航' })).toBeNull()
    expect(screen.queryByText('管理员登录与后台')).toBeNull(); expect(screen.queryByText('陈晓岚')).toBeNull()
    expect(document.title).toBe('乡桥API开放平台 · api.nong.cloud')
  })
  it.each(['/login', '/members', '/workspace/buyer'])('api域名%s不会进入管理后台', async path => {
    setup('api.nong.cloud', path)
    expect(await screen.findByRole('heading', { name: 'API开放平台' })).toBeTruthy()
    expect(screen.queryByText('管理员登录与后台')).toBeNull()
  })
  it('本地独立预览可打开，m站点与其他路由保持管理入口', async () => {
    const view = setup('localhost', '/api-portal')
    expect(await screen.findByRole('heading', { name: 'API开放平台' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /乡桥开放平台/ }).getAttribute('href')).toBe('/api-portal')
    view.unmount(); setup('m.nong.cloud')
    expect(await screen.findByText('管理员登录与后台')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'API开放平台' })).toBeNull()
  })
  it('api-site发布模式即使通过IP访问也不会加载管理员入口', async () => {
    vi.stubEnv('MODE', 'api-site'); setup('127.0.0.1', '/login')
    expect(await screen.findByRole('heading', { name: 'API开放平台' })).toBeTruthy()
    expect(screen.queryByText('管理员登录与后台')).toBeNull()
  })
})
