import {test,before} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {findPaginated} from './pagination-helper.mjs'
const spec=JSON.parse(readFileSync(new URL('../../contracts/connected-data-v1.json',import.meta.url),'utf8'))
const base=process.env.XQ_TEST_API||'http://127.0.0.1:8080/api/v1',password=process.env.XQ_TEST_PASSWORD
if(!/^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/.test(base)||!password)throw new Error('Only explicit loopback API and local test password are permitted')
let admin,farmer,provider
async function call(path,{token,body,method,key,version,headers={}}={}) {
 const response=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{}),...(key?{'Idempotency-Key':key}:{}),...(version===undefined?{}:{'If-Match':String(version)}),...headers},body:body===undefined?undefined:JSON.stringify(body)})
 return {status:response.status,data:response.status===204?null:await response.json(),headers:response.headers}
}
async function ok(path,options){const r=await call(path,options);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.code,0);return r.data.data}
const write=(path,token,body,version,method)=>ok(path,{token,body,version,method,key:randomUUID()})
function type(value,rule,field){if(rule.endsWith('?')&&value===null)return;rule=rule.replace(/\?$/,'');if(rule==='integer')assert.ok(Number.isInteger(value),field);else if(rule==='array')assert.ok(Array.isArray(value),field);else if(rule==='instant')assert.ok(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value)&&Number.isFinite(Date.parse(value)),field);else if(rule==='date')assert.match(value,/^\d{4}-\d{2}-\d{2}$/);else if(rule==='object')assert.ok(value&&typeof value==='object'&&!Array.isArray(value),field);else assert.equal(typeof value,rule,field)}
function check(row,contract){assert.deepEqual(Object.keys(row).sort(),Object.keys(contract.fields).sort(),contract.name+' keys');for(const [field,rule]of Object.entries(contract.fields))type(row[field],rule,field);if(contract.statuses)assert.ok(contract.statuses.includes(row.status));assert.ok(!Object.keys(row).some(k=>k.includes('_')),'no raw JDBC/private snake_case fields')}
before(async()=>{for(const [name,set]of [['admin.local',v=>admin=v],['farmer.local',v=>farmer=v],['provider.local',v=>provider=v]])set(await ok('/auth/password/login',{body:{username:name,password}}));await ok('/identities/identity-provider/switch',{token:provider.token,body:{}});await ok('/identities/identity-farmer/switch',{token:farmer.token,body:{}})})
test('database rows match the same camelCase, time, number and nullable contract in every implemented list',async()=>{
 await write('/farm-activities',farmer.token,{plotId:'plot-local-001',operation:'格式核对',note:'保留说明',clientSeq:randomUUID(),occurredAt:new Date().toISOString()})
 await write('/service-requests',farmer.token,{plotId:'plot-local-001',standardId:'standard-local-001',scheduledDate:'2026-10-09'})
 const ticket=await write('/help-tickets',farmer.token,{category:'字段对齐',description:'两端使用同一套数据字段'})
 await write('/help-tickets/'+ticket.id+'/reply',admin.token,{reply:'数据库字段已核对',status:'resolved'},1)
 await write('/identity-applications',farmer.token,{role:'buyer',subjectName:'对齐测试主体',address:'联调地址',reason:'只写测试申请，不授予身份'})
 await write('/admin/news',admin.token,{title:'格式核对',body:'本地草稿，不公开'})
 await write('/card-requests',farmer.token,{kind:'issue',reason:'字段契约核对；只登记测试申请，不收款'})
 for(const [route,contract]of Object.entries(spec.lists)){const result=await ok(route+'?size=100',{token:(route==='/messages'?farmer:admin).token});assert.deepEqual(Object.keys(result).sort(),[...spec.page.fields].sort());assert.ok(result.items.length<=result.size);assert.ok(result.total>=result.items.length);assert.ok(result.items.length>0,route);for(const row of result.items)check(row,contract)}
 const p=await write('/plots',farmer.token,{name:'详情与列表一致',areaMu:'0.1234',crop:'葡萄',address:'本地字段联调'})
 check(p,spec.lists['/plots']);const detail=await ok('/plots/'+p.id,{token:farmer.token});const list=await ok('/plots?size=100',{token:farmer.token});assert.deepEqual(p,detail);assert.deepEqual(detail,list.items.find(x=>x.id===p.id))
})
test('all nine business queues have real scoped totals, stable pagination and validation',async()=>{
 for(let i=0;i<3;i++)await write('/help-tickets',farmer.token,{category:'分页联调'+i,description:'本地测试'+randomUUID()})
 for(const route of Object.keys(spec.lists)){
  const token=(route==='/messages'?farmer:admin).token,one=await ok(route+'?page=1&size=1',{token}),two=await ok(route+'?page=2&size=1',{token})
  assert.equal(one.size,1);assert.equal(two.page,2);assert.equal(one.total,two.total);assert.equal(one.hasNext,one.total>1);if(two.items.length)assert.notEqual(one.items[0].id,two.items[0].id)
  assert.equal((await call(route+'?page=0',{token})).status,422);assert.equal((await call(route+'?size=101',{token})).status,422)
 }
 const own=await ok('/help-tickets?size=1',{token:farmer.token}),all=await ok('/help-tickets?size=1',{token:admin.token});assert.ok(all.total>=own.total)
})
test('ABC saved configuration is read back without implying device acknowledgment',async()=>{
 const before=await ok('/cards/card-local-001/configuration',{token:farmer.token}),configuration={A:'对齐修剪',B:'对齐灌溉',C:'对齐巡田'}
 await write('/cards/card-local-001/configuration',farmer.token,configuration,before.desiredConfigVersion,'PUT')
 const after=await ok('/cards/card-local-001/configuration',{token:farmer.token});assert.deepEqual(after.configuration,configuration);assert.equal(after.desiredConfigVersion,before.desiredConfigVersion+1);assert.equal(after.acknowledgedConfigVersion,before.acknowledgedConfigVersion);assert.equal(after.deviceConfirmed,false)
 const card=await findPaginated(path=>ok(path,{token:farmer.token}),'/cards',after.id)
 assert.ok(card,'the persisted card must be reachable through pagination');assert.deepEqual(card.configuration,configuration)
})
test('wrong boolean types fail validation and cannot reject a plot or enable a channel silently',async()=>{
 const plot=await write('/plots',farmer.token,{name:'布尔值验证',areaMu:'1',crop:'葡萄',address:'本地测试'})
 assert.equal((await call('/admin/plots/'+plot.id+'/verify',{token:admin.token,body:{approved:'true'},key:randomUUID(),version:1})).status,422)
 assert.equal((await ok('/plots/'+plot.id,{token:farmer.token})).status,'pending')
 assert.equal((await call('/admin/social-accounts/douyin',{token:admin.token,method:'PUT',body:{displayName:'错误类型',url:'https://www.douyin.com/',enabled:'true'},key:randomUUID()})).status,422)
})
test('stale expected identity fails before any write; refreshing profile remains possible',async()=>{
 const logged=await ok('/auth/password/login',{body:{username:'farmer.local',password}})
 await ok('/identities/identity-farmer-team/switch',{token:logged.token,body:{}})
 const stale=await call('/help-tickets',{token:logged.token,body:{category:'不应保存',description:'旧身份'},key:randomUUID(),headers:{'X-XQ-Identity':'identity-farmer'}})
 assert.equal(stale.status,409);assert.equal(stale.data.errorCode,'XQ-IDENTITY-409')
 assert.equal((await ok('/users/me',{token:logged.token,headers:{'X-XQ-Identity':'identity-farmer'}})).activeIdentityId,'identity-farmer-team')
 await ok('/auth/logout',{token:logged.token,body:{}})
})
test('CORS credentialed preflight supports both clients and rejects unknown origins, headers and methods',async()=>{
 for(const origin of ['http://127.0.0.1:4199','http://127.0.0.1:4201','http://localhost:4199']){
  const preflight=await call('/help-tickets',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,authorization,idempotency-key,if-match,x-xq-client,x-xq-identity'}})
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);assert.equal(preflight.headers.get('access-control-allow-credentials'),'true');assert.match(preflight.headers.get('access-control-allow-headers'),/X-XQ-Identity/);assert.match(preflight.headers.get('vary'),/Origin/)
 }
 for(const origin of ['null','https://evil.example','http://127.0.0.1:41990']){const r=await call('/health',{headers:{Origin:origin}});assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null)}
 assert.equal((await call('/health',{method:'OPTIONS',headers:{Origin:'http://127.0.0.1:4199','Access-Control-Request-Method':'TRACE'}})).status,403)
 assert.equal((await call('/health',{method:'OPTIONS',headers:{Origin:'http://127.0.0.1:4199','Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'x-evil'}})).status,403)
 const denied=await call('/plots',{headers:{Origin:'http://127.0.0.1:4199'}});assert.equal(denied.status,401);assert.equal(denied.headers.get('access-control-allow-origin'),'http://127.0.0.1:4199');assert.ok(denied.data.traceId)
})
test('work-order actions and acceptance notes align with actual server permissions, without exposing actor internals',async()=>{
 const demand=await write('/service-requests',farmer.token,{plotId:'plot-local-001',standardId:'standard-local-001',scheduledDate:'2026-10-09'})
 const order=await write('/service-requests/'+demand.id+'/claim',provider.token,{},1)
 let row=(await ok('/work-orders?size=100',{token:provider.token})).items.find(x=>x.id===order.id);assert.deepEqual(row.availableActions,['check-in'])
 assert.deepEqual((await ok('/work-orders?size=100',{token:admin.token})).items.find(x=>x.id===order.id).availableActions,[])
 await write('/work-orders/'+order.id+'/check-in',provider.token,{},1);await write('/work-orders/'+order.id+'/submit',provider.token,{note:'完工说明原文'},2)
 row=(await ok('/work-orders?size=100',{token:farmer.token})).items.find(x=>x.id===order.id);assert.deepEqual(row.availableActions,['accept','dispute']);assert.equal(row.completionNote,'完工说明原文')
 await write('/work-orders/'+order.id+'/accept',farmer.token,{note:'种植主体验收说明'},3)
 row=(await ok('/work-orders?size=100',{token:provider.token})).items.find(x=>x.id===order.id);assert.equal(row.acceptanceNote,'种植主体验收说明');assert.deepEqual(row.availableActions,[]);check(row,spec.lists['/work-orders'])
})
