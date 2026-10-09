// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'
import { getMe, login as loginRequest } from '../api/mock'
vi.mock('../api/mock', () => ({ getMe: vi.fn(async () => ({ data: { id:'admin-demo',name:'演示管理员',role:'县域运营管理员' } })), login: vi.fn(async () => ({ data: { token:'mock-token',user:{id:'admin-demo',name:'演示管理员',role:'县域运营管理员'} } })) }))
function Probe() { const auth=useAuth();return <><span>{auth.restoring?'恢复中':auth.session?'已登录':'待登录'}</span><p>{auth.warning}</p><button onClick={()=>void auth.login('mock','mock')}>登录演示</button><button onClick={auth.logout}>退出演示</button></> }
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear()})
it('损坏缓存恢复为登录页，不删除其他业务草稿',async()=>{localStorage.setItem('fuan-admin-session-v1','broken');localStorage.setItem('business-draft','keep');render(<AuthProvider><Probe/></AuthProvider>);await screen.findByText('待登录');expect(screen.getByText(/格式损坏/)).toBeTruthy();expect(localStorage.getItem('business-draft')).toBe('keep');expect(localStorage.getItem('fuan-admin-session-v1')).toBe('broken')})
it('禁止存储仍可进行当前页面演示登录与退出',async()=>{vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked')});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked')});vi.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw new Error('blocked')});render(<AuthProvider><Probe/></AuthProvider>);await screen.findByText('待登录');fireEvent.click(screen.getByRole('button',{name:'登录演示'}));await screen.findByText('已登录');expect(screen.getByText(/当前页面有效/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'退出演示'}));await waitFor(()=>expect(screen.getByText('待登录')).toBeTruthy())})
it('退出之后迟到的缓存恢复不能重新登录',async()=>{
 const value=await getMe('mock-token');let finish!:()=>void
 vi.mocked(getMe).mockImplementationOnce(()=>new Promise(resolve=>{finish=()=>resolve(value)}))
 localStorage.setItem('fuan-admin-session-v1',JSON.stringify({token:'mock-token'}))
 render(<AuthProvider><Probe/></AuthProvider>);fireEvent.click(screen.getByRole('button',{name:'退出演示'}))
 await act(async()=>{finish()});await screen.findByText('待登录');expect(localStorage.getItem('fuan-admin-session-v1')).toBeNull()
})
it('退出之后迟到的演示登录不能恢复会话或写回缓存',async()=>{
 const value=await loginRequest('mock','mock');let finish!:()=>void
 vi.mocked(loginRequest).mockImplementationOnce(()=>new Promise(resolve=>{finish=()=>resolve(value)}))
 render(<AuthProvider><Probe/></AuthProvider>);await screen.findByText('待登录');fireEvent.click(screen.getByRole('button',{name:'登录演示'}));fireEvent.click(screen.getByRole('button',{name:'退出演示'}))
 await act(async()=>{finish()});await screen.findByText('待登录');expect(localStorage.getItem('fuan-admin-session-v1')).toBeNull()
})
