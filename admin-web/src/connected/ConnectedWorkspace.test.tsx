// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ConnectedWorkspace from './ConnectedWorkspace'
import {MemoryRouter} from 'react-router-dom'
const renderWorkspace=()=>render(<MemoryRouter><ConnectedWorkspace/></MemoryRouter>)
const me={user:{id:'u',name:'本地测试'},identities:[{id:'i1',role:'farmer',label:'种植户',org:'测试主体',centerName:'测试中心',centerId:'c',subjectId:'s'}],activeIdentityId:'i1',permissions:['cards.read','records.read','plots.read','services.claim']}
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
function api(){const fetch=vi.fn().mockImplementation(async(url:string)=>{
 const path=new URL(url,'http://localhost').pathname,params=new URL(url,'http://localhost').searchParams,page=Number(params.get('page')||1)
 const items=path.endsWith('/cards')?[{id:'card',status:'active',configuration:{A:'真实修剪',B:'真实灌溉',C:'真实巡田'},desiredConfigVersion:4,acknowledgedConfigVersion:0}]:path.endsWith('/farm-activities')?[{id:'f',operation:'巡田',note:'真实数据库说明',source:'manual',occurredAt:'2026-10-07T01:00:00Z'}]:path.endsWith('/work-orders')?[{id:'order',operation:'巡田工单',status:'claimed',availableActions:[],completionNote:null,acceptanceNote:'独立验收说明'}]:[]
 return {ok:true,status:200,json:async()=>({code:0,data:path.endsWith('/users/me')?me:{items,total:21,page,size:20,hasNext:page===1},traceId:'local'})}
 });vi.stubGlobal('fetch',fetch);return fetch}
it('persisted card mapping renders and lists use actual pagination and expected identity',async()=>{
 const fetch=api();renderWorkspace();await screen.findByRole('heading',{name:'地块档案',level:1})
 fireEvent.click(screen.getByRole('button',{name:'农事卡'}));expect(await screen.findByText(/A 键：真实修剪/)).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'下一页'}));await screen.findByText(/共 21 条 · 第 2 页/)
 expect(fetch.mock.calls.some(([url,options])=>String(url).includes('/cards?page=2')&&options.headers['X-XQ-Identity']==='i1')).toBe(true)
})
it('manual record metadata includes note, source and UTC time',async()=>{
 api();renderWorkspace();await screen.findByRole('heading',{name:'地块档案',level:1});fireEvent.click(screen.getByRole('button',{name:'农事记录'}))
 expect(await screen.findByText(/真实数据库说明/)).toBeTruthy();expect(screen.getByText(/人工记录/)).toBeTruthy();expect(screen.getByText(/2026-10-07T01:00:00Z/)).toBeTruthy()
})
it('a service role cannot see a state-only start button without server action permission',async()=>{
 api();renderWorkspace();await screen.findByRole('heading',{name:'地块档案',level:1});fireEvent.click(screen.getByRole('button',{name:'服务工单'}))
 await screen.findByText(/独立验收说明/);await waitFor(()=>expect(screen.queryByRole('button',{name:'开工'})).toBeNull())
})
it('changing modules clears the old list before new rows are available',async()=>{
 const fetch=api();renderWorkspace();await screen.findByRole('heading',{name:'地块档案',level:1});fireEvent.click(screen.getByRole('button',{name:'农事记录'}));await screen.findByText(/真实数据库说明/)
 fetch.mockImplementation(()=>new Promise(()=>{}));fireEvent.click(screen.getByRole('button',{name:'农事卡'}))
 expect(screen.queryByText(/真实数据库说明/)).toBeNull();expect(screen.queryByText(/Vundefined/)).toBeNull();expect(screen.getByText(/正在读取当前身份/)).toBeTruthy()
})
it('an unimplemented deep link cannot read or render a different business module',async()=>{const fetch=api();render(<MemoryRouter initialEntries={['/manage/production/soil']}><ConnectedWorkspace/></MemoryRouter>);await screen.findByText('此页面尚未接入数据库');expect(fetch.mock.calls.some(([url])=>String(url).includes('/plots'))).toBe(false)})
it('finance deep links deny non-finance identities instead of exposing a prototype or unrelated plots',async()=>{const fetch=api();render(<MemoryRouter initialEntries={['/manage/finance/settlement']}><ConnectedWorkspace/></MemoryRouter>);await screen.findByText('当前身份不能访问此模块');expect(fetch.mock.calls.some(([url])=>String(url).includes('/admin/settlement-plans')||String(url).includes('/plots'))).toBe(false)})
it('card pricing cannot be confused with a farmer membership fee in either quote or database metadata',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,status:200,json:async()=>({code:0,traceId:'qa',data:url.includes('/users/me')?{...me,permissions:['cards.request']}:{items:url.includes('/card-requests')?[{id:'q',kind:'issue',feeFen:10000,reason:'本地费用核对',status:'pending'}]:[],total:1,page:1,size:20,hasNext:false}})})))
 render(<MemoryRouter initialEntries={['/card-requests']}><ConnectedWorkspace/></MemoryRouter>);expect(await screen.findByText(/办卡\/补卡报价：100.00元/)).toBeTruthy();expect(screen.queryByText(/会员费用：100/)).toBeNull()
})
it('membership withdrawal uses server actions, a required reason and the current version instead of local approval',async()=>{
 const fetch=vi.fn<(url:string,options:{body:string;headers:Record<string,string>})=>Promise<unknown>>(async(url)=>({ok:true,status:200,json:async()=>({code:0,traceId:'qa',data:url.includes('/users/me')?{...me,permissions:['membership.read','membership.apply']}:url.includes('/membership-plans')?{items:[],total:0,page:1,size:20,hasNext:false}:url.includes('/cancel')?{id:'m',status:'cancelled',refundExecuted:false}:{items:[{id:'m',name:'收费方案',status:'awaiting_payment',feeFen:49900,version:2,availableActions:['cancel']}],total:1,page:1,size:20,hasNext:false}})}));vi.stubGlobal('fetch',fetch)
 render(<MemoryRouter initialEntries={['/memberships']}><ConnectedWorkspace/></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:'撤回申请（不等于退款）'}))
 const reason=screen.getByRole('textbox',{name:'执行或验收说明'});expect((reason as HTMLTextAreaElement).required).toBe(true);fireEvent.change(reason,{target:{value:'不再申请'}});fireEvent.click(screen.getByRole('button',{name:'确认提交'}))
 await waitFor(()=>expect(fetch.mock.calls.some(([url])=>url.endsWith('/memberships/m/cancel'))).toBe(true));const request=fetch.mock.calls.find(([url])=>url.endsWith('/memberships/m/cancel'))![1];expect(JSON.parse(request.body)).toEqual({note:'不再申请'});expect(request.headers['If-Match']).toBe('2');expect(request.headers['X-XQ-Identity']).toBe('i1');expect(request.headers['Idempotency-Key']).toBeTruthy()
})
it('state alone cannot expose withdrawal controls without server availableActions',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,status:200,json:async()=>({code:0,data:url.includes('/users/me')?{...me,permissions:['services.request']}:url.includes('/service-standards')?[]:{items:[{id:'r',operation:'未接单但无取消授权',status:'open',version:1,availableActions:[]}],total:1,page:1,size:20,hasNext:false}})})))
 render(<MemoryRouter initialEntries={['/service-requests']}><ConnectedWorkspace/></MemoryRouter>);await screen.findByText('未接单但无取消授权');expect(screen.queryByRole('button',{name:'取消未接单需求'})).toBeNull()
})
