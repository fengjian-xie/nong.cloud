// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { roles } from '../portals/config'
import { RootApp } from '../app/RootApp'
import WorkSite from './WorkSite'
import { clearWorkDemoData, demoAccounts, hasIdentity, isWorkSiteHost, loadDemoSession, saveDemoSession, WORK_SESSION_KEY } from './site'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); sessionStorage.clear(); localStorage.clear() })
const setup = (path = '/') => render(<MemoryRouter initialEntries={[path]}><WorkSite/></MemoryRouter>)
async function login() {
  fireEvent.click(await screen.findByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '登录演示账号' }))
  await screen.findByRole('heading', { name: '安心种好地，记录有人帮。' })
}

describe('主体端一次登录、多身份工作台', () => {
  it('退出只清理本账号业务缓存，不清理其他账号或无关数据', () => {
    localStorage.setItem('xiangqiao:work-demo:farm:farm-service','[1]')
    localStorage.setItem('xiangqiao:work-demo:portal:farm-service','[2]')
    localStorage.setItem('xiangqiao:work-demo:portal:co-op','[3]')
    localStorage.setItem('xiangqiao:work-demo:help:farm-service:farmer','help1')
    localStorage.setItem('xiangqiao:work-demo:help:farm-service:team','help2')
    localStorage.setItem('xiangqiao:work-demo:help:co-op:cooperative','help3')
    localStorage.setItem('unrelated','keep')
    expect(clearWorkDemoData('farm-service')).toBe('')
    expect(localStorage.getItem('xiangqiao:work-demo:portal:farm-service')).toBeNull()
    expect(localStorage.getItem('xiangqiao:work-demo:farm:farm-service')).toBeNull()
    expect(localStorage.getItem('xiangqiao:work-demo:portal:co-op')).toBe('[3]')
    expect(localStorage.getItem('xiangqiao:work-demo:help:farm-service:farmer')).toBeNull()
    expect(localStorage.getItem('xiangqiao:work-demo:help:farm-service:team')).toBeNull()
    expect(localStorage.getItem('xiangqiao:work-demo:help:co-op:cooperative')).toBe('help3')
    expect(localStorage.getItem('unrelated')).toBe('keep')
  })
  it('精确域名，八个示例账号覆盖11类身份，身份不共享授权', () => {
    expect(isWorkSiteHost('WORK.NONG.CLOUD')).toBe(true)
    for (const host of ['m.nong.cloud', 'work.nong.cloud.attacker.test', 'nongfu.tech']) expect(isWorkSiteHost(host)).toBe(false)
    expect(new Set(demoAccounts.flatMap(a => [...a.roles])).size).toBe(roles.length)
    expect(hasIdentity(demoAccounts[0], 'team')).toBe(true)
    expect(hasIdentity(demoAccounts[0], 'buyer')).toBe(false)
  })
  it('没有手机号、密码和虚假验证码，进入需要演示确认', async () => {
    setup()
    expect(await screen.findByText('此账号拥有 2 个演示身份')).toBeTruthy()
    expect(screen.queryByLabelText('手机号')).toBeNull()
    expect((screen.getByRole('button', { name: '正式登录（待接入）' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '登录演示账号' }))
    expect(screen.getByRole('alert').textContent).toContain('确认')
  })
  it('一次进入可在种植户和农服队切换，不开放未绑定身份，刷新恢复当前身份', async () => {
    const view = setup()
    await login()
    const selector = screen.getByLabelText('切换工作身份')
    fireEvent.click(selector)
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['种植户', '农服队'])
    fireEvent.click(screen.getByRole('option', { name: '农服队' }))
    expect(await screen.findByRole('heading', { name: '从接单到验收，每一步都有回响。' })).toBeTruthy()
    expect(loadDemoSession().session).toEqual({ version: 2, accountId: 'farm-service', activeRole: 'team' })
    expect(screen.queryByRole('button', { name: '登录演示账号' })).toBeNull()
    view.unmount(); setup('/workspace/team')
    expect(await screen.findByRole('heading', { name: '从接单到验收，每一步都有回响。' })).toBeTruthy()
  })
  it('未登录深链回登录，登录后直接打开未绑定身份会被阻断', async () => {
    const view = setup('/workspace/farmer')
    expect(await screen.findByRole('button', { name: '登录演示账号' })).toBeTruthy()
    view.unmount()
    saveDemoSession({ version: 2, accountId: 'farm-service', activeRole: 'farmer' })
    setup('/workspace/buyer')
    expect(await screen.findByRole('heading', { name: '当前账号没有此身份' })).toBeTruthy()
    expect(screen.queryByText('好货在哪里，什么时候成熟。')).toBeNull()
  })
  it('退出使整个账号及其所有工作身份失效', async () => {
    setup(); await login()
    fireEvent.click(screen.getByRole('combobox', { name: '切换工作身份' }))
    fireEvent.click(screen.getByRole('option', { name: '农服队' }))
    await screen.findByRole('heading', { name: '从接单到验收，每一步都有回响。' })
    fireEvent.click(screen.getByRole('button', { name: '退出演示' }))
    expect(await screen.findByRole('button', { name: '登录演示账号' })).toBeTruthy()
    expect(sessionStorage.getItem(WORK_SESSION_KEY)).toBeNull()
  })
  it('不接受非法或过期会话，额外字段不成为权限', () => {
    for (const value of ['invalid', '{"version":1,"accountId":"farm-service","activeRole":"team"}', '{"version":2,"accountId":"farm-service","activeRole":"buyer"}', '{"version":2,"accountId":"unknown","activeRole":"farmer"}']) {
      sessionStorage.setItem(WORK_SESSION_KEY, value)
      expect(loadDemoSession().session).toBeUndefined()
    }
    sessionStorage.setItem(WORK_SESSION_KEY, '{"version":2,"accountId":"farm-service","activeRole":"team","token":"not-a-token","roles":["buyer"]}')
    expect(loadDemoSession().session).toEqual({ version: 2, accountId: 'farm-service', activeRole: 'team' })
  })
  it('储存禁用时仍可在当前页面切换身份并退出', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    setup(); await login()
    fireEvent.click(screen.getByRole('combobox', { name: '切换工作身份' }))
    fireEvent.click(screen.getByRole('option', { name: '农服队' }))
    expect(await screen.findByRole('heading', { name: '从接单到验收，每一步都有回响。' })).toBeTruthy()
  })
  it('work域名与API独立，API路由优先级不变', async () => {
    const view = render(<MemoryRouter><RootApp hostname="work.nong.cloud"/></MemoryRouter>)
    expect(await screen.findByRole('button', { name: '登录演示账号' })).toBeTruthy()
    view.unmount(); vi.stubEnv('MODE', 'work-site')
    render(<MemoryRouter><RootApp hostname="api.nong.cloud"/></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'API开放平台' })).toBeTruthy()
  })
})
