import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'

const base=process.env.XQ_TEST_API||'http://127.0.0.1:8080/api/v1',password=process.env.XQ_TEST_PASSWORD
if(!/^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/.test(base)||!password)throw new Error('Only the loopback API and synthetic local password are permitted')
const sessions=[]
let root,parent,child,admin,farmer,plot
async function call(path,{token,body,raw,method,version,key}={}) {
 const response=await fetch(base+path,{method:method||(body===undefined&&raw===undefined?'GET':'POST'),headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined&&raw===undefined?{}:{'Content-Type':'application/json'}),...(version===undefined?{}:{'If-Match':String(version)}),...(key?{'Idempotency-Key':key}:{})},body:raw??(body===undefined?undefined:JSON.stringify(body))})
 return {status:response.status,envelope:await response.json()}
}
async function ok(path,options){const response=await call(path,options);assert.equal(response.status,200,JSON.stringify(response.envelope));return response.envelope.data}
const write=(path,who,body,version)=>ok(path,{token:who.token,body,version,key:randomUUID()})
async function login(username){const who=await ok('/auth/password/login',{body:{username,password}});sessions.push(who);return who}
async function switchTo(who,id){Object.assign(who,await ok('/identities/'+id+'/switch',{token:who.token,body:{}}))}
before(async()=>{
 root=await login('admin.local');await switchTo(root,'identity-admin')
 parent=await write('/admin/centers',root,{name:'审查测试中心 '+randomUUID(),countyCode:'350981'})
 admin=await login('admin.local');await switchTo(admin,parent.adminIdentityId)
 child=await write('/admin/centers',admin,{name:'审查测试下级中心 '+randomUUID(),countyCode:'350981'})
 farmer=await ok('/auth/local-register',{body:{username:'qa.review.'+randomUUID(),password,name:'独立审查测试种植户',centerId:parent.id}});sessions.push(farmer)
 const application=await write('/identity-applications',farmer,{role:'farmer',subjectName:'审查测试主体',address:'福安本地测试地址',reason:'只创建本地测试资料'})
 await write('/admin/identity-applications/'+application.id+'/review',admin,{approved:true},1)
 const me=await ok('/users/me',{token:farmer.token});await switchTo(farmer,me.identities.find(i=>i.role==='farmer').id)
 plot=await write('/plots',farmer,{name:'独立审查测试地块',areaMu:1,crop:'葡萄',address:'本地测试'})
 await write('/admin/plots/'+plot.id+'/verify',admin,{approved:true},1)
})
test('suspending a parent hides descendant public news and social configuration, then restores them',async()=>{
 const childAdmin=await login('admin.local');await switchTo(childAdmin,child.adminIdentityId)
 const article=await write('/admin/news',childAdmin,{title:'仅本地公开测试 '+randomUUID(),body:'不是线上发布'})
 await write('/admin/news/'+article.id+'/publish',childAdmin,{},1)
 await ok('/admin/social-accounts/douyin',{token:childAdmin.token,method:'PUT',body:{displayName:'本地测试',url:'https://www.douyin.com/',enabled:true},key:randomUUID()})
 assert.equal((await ok('/public/news?center='+child.id)).length,1)
 assert.equal((await ok('/public/site-config?center='+child.id)).length,1)
 await write('/admin/centers/'+parent.id+'/status',root,{active:false},1)
 try {
  assert.deepEqual(await ok('/public/news?center='+child.id),[])
  assert.deepEqual(await ok('/public/site-config?center='+child.id),[])
 } finally {await write('/admin/centers/'+parent.id+'/status',root,{active:true},2)}
 assert.equal((await ok('/public/news?center='+child.id)).length,1)
})
test('fractional monetary input must not be rounded into a valid integer by JSON parsing',async()=>{
 const raw=JSON.stringify({plotId:plot.id,grade:'审查精度',quantityKg:1}).slice(0,-1)+',"unitPriceFenKg":101.00000000000000000001}'
 const response=await call('/stock-batches',{token:farmer.token,raw,key:randomUUID()})
 assert.equal(response.status,422,JSON.stringify(response.envelope))
})
test('excess quantity precision must not be rounded to three decimal places before validation',async()=>{
 const raw=JSON.stringify({plotId:plot.id,grade:'审查精度',unitPriceFenKg:100}).slice(0,-1)+',"quantityKg":1.00000000000000000001}'
 const response=await call('/stock-batches',{token:farmer.token,raw,key:randomUUID()})
 assert.equal(response.status,422,JSON.stringify(response.envelope))
})
test('timestamps beyond PostgreSQL microsecond precision are explicitly rejected instead of silently changed',async()=>{
 const response=await call('/farm-activities',{token:farmer.token,body:{plotId:plot.id,operation:'时间精度测试',occurredAt:'2026-10-07T01:00:00.123456789Z',clientSeq:randomUUID()},key:randomUUID()})
 assert.equal(response.status,422,JSON.stringify(response.envelope))
})
test('microsecond timestamps survive database reread and same-event retry without a conflict',async()=>{
 const body={plotId:plot.id,operation:'微秒精度测试',occurredAt:'2026-10-07T01:00:00.123456Z',clientSeq:randomUUID()}
 const created=await write('/farm-activities',farmer,body),retry=await write('/farm-activities',farmer,body)
 assert.equal(retry.id,created.id);assert.equal(retry.duplicate,true)
 const rows=await ok('/farm-activities',{token:farmer.token});assert.equal(rows.items.find(row=>row.id===created.id).occurredAt,body.occurredAt)
})
test('device batches reject unrepresentable timestamps atomically without acknowledging partial evidence',async()=>{
 const application=await write('/card-requests',farmer,{kind:'issue',reason:'只做本地事件校验'})
 await write('/admin/card-requests/'+application.id+'/review',admin,{approved:true,reviewNote:'仅本地云端登记'},1)
 const registered=await write('/admin/card-requests/'+application.id+'/register',admin,{},2)
 const event={eventId:randomUUID(),button:'A',bindingVersion:1,configVersion:1,fixStatus:'failed',occurredAt:'2026-10-07T01:00:00.123456Z'}
 const response=await call('/cards/'+registered.newCardId+'/events',{token:farmer.token,body:{events:[event,{...event,eventId:randomUUID(),occurredAt:'2026-10-07T01:00:00.123456789Z'}]},key:randomUUID()})
 assert.equal(response.status,422,JSON.stringify(response.envelope))
 assert.equal((await ok('/cards/'+registered.newCardId+'/events',{token:farmer.token})).total,0)
})
after(async()=>{for(const who of sessions)await call('/auth/logout',{token:who.token,body:{}})})
