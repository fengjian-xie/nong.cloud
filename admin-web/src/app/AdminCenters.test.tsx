// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { FarmProvider } from '../farm/FarmProvider'
import { AdminCenterPage, LegacyAdminRedirect } from './AdminCenters'
import { adminCenters, centerPath } from './centers'
let role='县域运营管理员'
vi.mock('../auth/AuthContext',()=>({useAuth:()=>({session:{user:{id:'review-demo',name:'测试运营员',role}},restoring:false,logout:vi.fn()})}))
function Location(){const l=useLocation();return <output aria-label="页面地址">{l.pathname+l.search+l.hash}</output>}
function setup(path:string){return render(<MemoryRouter initialEntries={[path]}><FarmProvider><Location/><Routes><Route path="/manage/:centerId/:section?" element={<AdminCenterPage/>}/><Route path="*" element={<LegacyAdminRedirect/>}/></Routes></FarmProvider></MemoryRouter>)}
afterEach(()=>{cleanup();localStorage.clear();role='县域运营管理员'})
it.each(adminCenters.filter(c=>c.id!=='overview'))('$name中心默认入口可打开，二级目录保留',async center=>{setup(`/manage/${center.id}`);await screen.findByRole('navigation',{name:`${center.name}业务目录`});expect(screen.getByLabelText('页面地址').textContent).toBe(centerPath(center.id));for(const tab of center.tabs)expect(screen.getByRole('link',{name:tab.label})).toBeTruthy()})
it('旧成熟链接保留地块筛选并落在对应视图',async()=>{setup('/maturity?plot=SZT-001');await screen.findByRole('button',{name:'供货日历'});expect(screen.getByLabelText('页面地址').textContent).toBe('/manage/trade/supply?plot=SZT-001&view=map');fireEvent.click(screen.getByRole('button',{name:'供货日历'}));await screen.findByRole('heading',{name:'采收供货日历'});expect(screen.getByLabelText('页面地址').textContent).toContain('plot=SZT-001&view=calendar')})
it('县域运营不能因菜单出现而获得分账权限',async()=>{setup('/manage/finance/settlement');await screen.findByRole('heading',{name:'当前岗位无财务查看权限'});expect(screen.queryByLabelText('支付管理模块')).toBeNull()})
it('财务岗位可看本地测算，商家权益页不再包含支付配置',async()=>{role='财务管理员';const view=setup('/manage/finance/settlement');await screen.findByLabelText('支付管理模块');fireEvent.change(screen.getByLabelText('支付管理模块'),{target:{value:'分账测算'}});expect(screen.getByRole('button',{name:'计算本地示例'})).toBeTruthy();view.unmount();setup('/manage/trade/membership');await screen.findByRole('heading',{name:'商家服务与会员'});expect(screen.queryByLabelText('支付管理模块')).toBeNull()})
it('未知中心或页面失败关闭，不误显示成功或授权',()=>{setup('/manage/unknown/all');expect(screen.getByRole('heading',{name:'没有这个业务中心'})).toBeTruthy()})
