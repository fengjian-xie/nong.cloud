// @vitest-environment jsdom
import {render,screen,cleanup,waitFor} from '@testing-library/react'
import {afterEach,it,expect,vi} from 'vitest'
import {WorkGuidance} from './WorkGuidance'
import {validGuidance} from './guidance'
const guide={version:'stakeholder-v1',identityId:'i1',role:'farmer',title:'种植户办事指引',steps:[{module:'records',title:'补充记录',detail:'人工记录不等于质量认证'}],checks:['独立验收'],fees:[{label:'种植主体平台服务费',feeFen:0,note:'平台免费'},{label:'办卡/补卡报价',feeFen:10000,note:'仅报价，不收款'}],limits:['不授予权限']}
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it('guidance validates identity, array shapes and integer fee units',()=>{
 expect(validGuidance(guide,'i1')).toBe(true);expect(validGuidance(guide,'i2')).toBe(false)
 expect(validGuidance({...guide,fees:[{...guide.fees[0],feeFen:0.1}]},'i1')).toBe(false)
 expect(validGuidance({...guide,checks:'not an array'},'i1')).toBe(false)
 expect(validGuidance({...guide,steps:[{module:'records'}]},'i1')).toBe(false)
})
it('shows farmer platform zero separately from 100 yuan card quote and scopes the read request',async()=>{
 const fetch=vi.fn<(url:string,options:{headers:Record<string,string>})=>Promise<unknown>>(async()=>({ok:true,json:async()=>({code:0,data:guide})}));vi.stubGlobal('fetch',fetch)
 render(<WorkGuidance identity="i1"/>);expect(await screen.findByText('种植主体平台服务费：0.00元')).toBeTruthy();expect(screen.getByText('办卡/补卡报价：100.00元')).toBeTruthy()
 expect(fetch.mock.calls[0][1].headers['X-XQ-Identity']).toBe('i1')
})
it('an old delayed guidance response cannot overwrite a changed identity',async()=>{
 let resolveOld!:(v:unknown)=>void
 vi.stubGlobal('fetch',vi.fn((_,opts)=>opts.headers['X-XQ-Identity']==='i1'?new Promise(resolve=>{resolveOld=resolve}):Promise.resolve({ok:true,json:async()=>({code:0,data:{...guide,identityId:'i2',role:'supplier',title:'农资商指引',fees:[]}})})))
 const view=render(<WorkGuidance identity="i1"/>);view.rerender(<WorkGuidance identity="i2"/>);await screen.findByText('农资商指引');resolveOld({ok:true,json:async()=>({code:0,data:guide})})
 await waitFor(()=>expect(screen.queryByText('种植户办事指引')).toBeNull());expect(screen.queryByText(/100.00元/)).toBeNull()
})
it('malformed or failed guidance stays unavailable without faking completion',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({code:0,data:{...guide,identityId:'other'}})})))
 render(<WorkGuidance identity="i1"/>);await screen.findByText(/办事指引暂不可用/);expect(screen.queryByText('种植户办事指引')).toBeNull()
})
