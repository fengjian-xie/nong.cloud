import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const base = process.env.XQ_TEST_API || 'http://127.0.0.1:8080/api/v1'
if (!/^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/.test(base)) throw new Error('Integration tests may only target an explicit loopback development API')
const password = process.env.XQ_TEST_PASSWORD
if (!password) throw new Error('Set XQ_TEST_PASSWORD; no production credentials or default password are embedded')
let admin, farmer, provider, other
async function call(path, { token, body, key, version, method, headers = {} } = {}) {
 const response = await fetch(base + path, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { ...(body === undefined ? {} : { 'Content-Type':'application/json' }), ...(token ? { Authorization:'Bearer '+token } : {}), ...(key ? { 'Idempotency-Key':key } : {}), ...(version === undefined ? {} : { 'If-Match':String(version) }), ...headers }, body:body === undefined ? undefined : JSON.stringify(body) })
 return { status:response.status, envelope:await response.json(), cookie:response.headers.get('set-cookie') }
}
async function ok(path, opts) { const r=await call(path,opts);assert.equal(r.status,200,JSON.stringify(r.envelope));assert.equal(r.envelope.code,0);assert.ok(r.envelope.traceId);return r.envelope.data }
async function write(path,token,body,version,key=randomUUID()) {return ok(path,{token,body,version,key})}
before(async () => {
 for(const [name,set] of [['admin.local',x=>admin=x],['farmer.local',x=>farmer=x],['provider.local',x=>provider=x],['other.local',x=>other=x]]) set(await ok('/auth/password/login',{body:{username:name,password}}))
 await ok('/identities/identity-provider/switch',{token:provider.token,body:{}})
 assert.equal((await ok('/health')).database,'postgresql')
})
test('opaque sessions, cookie flags, no anonymous private data, unconfigured WeChat fails closed',async()=>{
 const login=await call('/auth/password/login',{body:{username:'farmer.local',password}})
 assert.match(login.cookie,/HttpOnly/);assert.match(login.cookie,/SameSite=Lax/)
 assert.notEqual(login.envelope.data.token,'000000');assert.ok(login.envelope.data.token.length>=40)
 assert.equal((await call('/plots')).status,401)
 assert.equal((await call('/auth/wechat/login',{body:{code:'not-a-real-code'}})).status,503)
})
test('unimplemented business paths return explicit JSON 404, never mock success',async()=>{
 const r=await call('/payment-orders',{token:farmer.token});assert.equal(r.status,404);assert.equal(r.envelope.data,null);assert.ok(r.envelope.traceId);assert.equal(r.envelope.errorCode,'XQ-NOT-FOUND-404')
})
test('one account multiple identities; switching may not manufacture privileges',async()=>{
 assert.equal(farmer.identities.length,2)
 assert.equal((await call('/identities/identity-admin/switch',{token:farmer.token,body:{}})).status,403)
 await ok('/identities/identity-farmer-team/switch',{token:farmer.token,body:{}})
 assert.equal((await call('/plots',{token:farmer.token})).status,403)
 await ok('/identities/identity-farmer/switch',{token:farmer.token,body:{}})
})
test('center/subject isolation ignores client tenant and owner injection',async()=>{
 assert.equal((await call('/plots/plot-local-001',{token:other.token})).status,404)
 const p=await write('/plots',farmer.token,{name:'隔离测试地块',areaMu:'1.25',crop:'葡萄',address:'本地测试地址',centerId:'local-other',subjectId:'subject-other',status:'verified'})
 assert.equal(p.centerId,'local-fuan');assert.equal(p.subjectId,'subject-farmer');assert.equal(p.status,'pending')
 assert.equal((await call('/plots/'+p.id,{token:other.token})).status,404)
})
test('idempotency replay creates one row; payload collisions and missing keys reject',async()=>{
 const key=randomUUID(),body={category:'跨端测试',description:'小程序提交后，网页帮助中心应能看到此问题'}
 const first=await write('/help-tickets',farmer.token,body,undefined,key),replay=await write('/help-tickets',farmer.token,body,undefined,key)
 assert.deepEqual(first,replay)
 assert.equal((await call('/help-tickets',{token:farmer.token,body:{...body,description:'changed'},key})).status,409)
 assert.equal((await call('/help-tickets',{token:farmer.token,body})).status,422)
 const adminRows=await ok('/help-tickets',{token:admin.token});assert.equal(adminRows.items.filter(x=>x.id===first.id).length,1)
})
test('help reply generates scoped server message; stale version rejected',async()=>{
 const ticket=await write('/help-tickets',farmer.token,{category:'农事卡',description:'联调问题，需要中心回复'})
 assert.equal((await call('/help-tickets/'+ticket.id+'/reply',{token:provider.token,body:{reply:'越权',status:'resolved'},version:1,key:randomUUID()})).status,403)
 await write('/help-tickets/'+ticket.id+'/reply',admin.token,{reply:'中心已受理（本地测试）',status:'resolved'},1)
 assert.equal((await call('/help-tickets/'+ticket.id+'/reply',{token:admin.token,body:{reply:'旧版本',status:'resolved'},version:1,key:randomUUID()})).status,409)
 const messages=(await ok('/messages',{token:farmer.token})).items, message=messages.find(m=>m.body==='中心已受理（本地测试）');assert.ok(message)
 assert.equal((await call('/messages/'+message.id+'/read',{token:other.token,body:{},key:randomUUID()})).status,404)
 await write('/messages/'+message.id+'/read',farmer.token,{})
 assert.equal((await ok('/messages',{token:farmer.token})).items.find(m=>m.id===message.id).read,true)
})
test('manual records survive reread, source is server assigned; client sequence deduplicates',async()=>{
 const body={plotId:'plot-local-001',operation:'巡田',clientSeq:randomUUID(),occurredAt:'2026-10-07T01:00:00Z',note:'本地测试',source:'verified-device'}
 const row=await write('/farm-activities',farmer.token,body), duplicate=await write('/farm-activities',farmer.token,body)
 assert.equal(row.id,duplicate.id);assert.equal(duplicate.duplicate,true)
 const items=(await ok('/farm-activities',{token:farmer.token})).items;assert.equal(items.find(i=>i.id===row.id).source,'manual')
 assert.equal((await call('/farm-activities',{token:farmer.token,body:{...body,operation:'采收'},key:randomUUID()})).status,409)
})
test('formal plots cannot be silently overwritten; verification requires version and admin permission',async()=>{
 const patch={name:'改变',areaMu:'2',crop:'茶叶',address:'测试'}
 assert.equal((await call('/plots/plot-local-001',{token:farmer.token,method:'PATCH',body:patch,key:randomUUID(),version:1})).status,409)
 const p=await write('/plots',farmer.token,{name:'待核验',areaMu:'2',crop:'葡萄',address:'测试'})
 assert.equal((await call('/admin/plots/'+p.id+'/verify',{token:farmer.token,body:{approved:true},key:randomUUID(),version:1})).status,403)
 assert.equal((await call('/admin/plots/'+p.id+'/verify',{token:admin.token,body:{approved:true},key:randomUUID()})).status,428)
 const verified=await write('/admin/plots/'+p.id+'/verify',admin.token,{approved:true},1);assert.equal(verified.version,2)
})
test('immutable standard snapshot and one-winner claim, independent acceptance state machine',async()=>{
 const req=await write('/service-requests',farmer.token,{plotId:'plot-local-001',standardId:'standard-local-001',scheduledDate:'2026-10-08',operation:'伪造',standardText:'伪造'})
 await ok('/identities/identity-farmer-team/switch',{token:farmer.token,body:{}})
 assert.equal((await call('/service-requests/'+req.id+'/claim',{token:farmer.token,body:{},version:1,key:randomUUID()})).status,403)
 await ok('/identities/identity-farmer/switch',{token:farmer.token,body:{}})
 const attempts=await Promise.all([1,2].map(()=>call('/service-requests/'+req.id+'/claim',{token:provider.token,body:{},version:1,key:randomUUID()})))
 assert.deepEqual(attempts.map(a=>a.status).sort(),[200,409]);const order=attempts.find(a=>a.status===200).envelope.data
 const orders=(await ok('/work-orders',{token:provider.token})).items;assert.notEqual(orders.find(o=>o.id===order.id).standardText,'伪造')
 assert.equal((await call('/work-orders/'+order.id+'/accept',{token:farmer.token,body:{note:'未完工'},version:1,key:randomUUID()})).status,409)
 await write('/work-orders/'+order.id+'/check-in',provider.token,{},1)
 await write('/work-orders/'+order.id+'/submit',provider.token,{note:'测试完成巡田并列出问题'},2)
 assert.equal((await call('/work-orders/'+order.id+'/accept',{token:provider.token,body:{note:'自验收'},version:3,key:randomUUID()})).status,403)
 const accepted=await write('/work-orders/'+order.id+'/accept',farmer.token,{note:'种植主体独立确认'},3);assert.equal(accepted.status,'accepted');assert.equal(accepted.qualityCertified,false)
})
test('identity application does not grant rights until a separate admin approves',async()=>{
 const initial=await ok('/users/me',{token:provider.token}),app=await write('/identity-applications',provider.token,{role:'farmer',subjectName:'申请测试主体',address:'福建省宁德市福安市赛岐镇测试地址',reason:'本地联调测试'})
 assert.equal((await ok('/users/me',{token:provider.token})).identities.length,initial.identities.length)
 assert.equal((await call('/admin/identity-applications/'+app.id+'/review',{token:provider.token,body:{approved:true},version:1,key:randomUUID()})).status,403)
 await write('/admin/identity-applications/'+app.id+'/review',admin.token,{approved:true},1)
 assert.equal((await ok('/users/me',{token:provider.token})).identities.length,initial.identities.length+1)
 assert.equal((await call('/identity-applications',{token:farmer.token,body:{role:'center_admin',subjectName:'越权',address:'测试',reason:'测试'},key:randomUUID()})).status,403)
})
test('draft news stays private; publish and withdraw update public output only',async()=>{
 const article=await write('/admin/news',admin.token,{title:'接口联调新闻 '+randomUUID(),body:'这是本地数据库联调内容。'})
 assert.ok(!(await ok('/public/news')).some(n=>n.id===article.id))
 await write('/admin/news/'+article.id+'/publish',admin.token,{},1)
 const publicItem=(await ok('/public/news')).find(n=>n.id===article.id);assert.ok(publicItem);assert.equal(publicItem.author_id,undefined)
 await write('/admin/news/'+article.id+'/withdraw',admin.token,{},2)
 assert.ok(!(await ok('/public/news')).some(n=>n.id===article.id))
})
test('social links scoped to center, platform host must match channel',async()=>{
 assert.equal((await call('/admin/social-accounts/douyin',{token:admin.token,method:'PUT',body:{displayName:'测试',url:'https://www.xiaohongshu.com/test',enabled:true},key:randomUUID()})).status,422)
 await ok('/admin/social-accounts/douyin',{token:admin.token,method:'PUT',body:{displayName:'本地测试账号',url:'https://www.douyin.com/',enabled:true},key:randomUUID()})
 assert.ok((await ok('/public/site-config')).some(x=>x.channel==='douyin'))
 assert.equal((await ok('/public/site-config?center=local-other')).length,0)
})
test('offline events acknowledged only after atomic commit, duplicate evidence stays unverified',async()=>{
 const event={eventId:randomUUID(),bindingVersion:1,configVersion:1,button:'A',occurredAt:'2026-10-07T01:00:00Z',fixStatus:'failed'}
 const path='/cards/card-local-001/events'
 assert.equal((await call(path,{token:farmer.token,body:{events:[event,{...event,eventId:randomUUID(),button:'INVALID'}]},key:randomUUID()})).status,422)
 const first=await write(path,farmer.token,{events:[event]});assert.equal(first.receipts[0].duplicate,false);assert.equal(first.hardwareAuthenticated,false);assert.equal(first.receipts[0].verificationStatus,'unverified')
 const duplicate=await write(path,farmer.token,{events:[event]});assert.equal(duplicate.receipts[0].duplicate,true)
 assert.equal((await call(path,{token:farmer.token,body:{events:[{...event,button:'B'}]},key:randomUUID()})).status,409)
 const card=await ok('/cards/card-local-001/configuration',{token:farmer.token})
 const config=await ok('/cards/card-local-001/configuration',{token:farmer.token,method:'PUT',body:{A:'修剪',B:'灌溉',C:'巡查'},version:card.desiredConfigVersion,key:randomUUID()})
 assert.equal(config.deviceConfirmed,false);assert.equal(config.acknowledgedConfigVersion,0)
})
test('cookie write needs allowed Origin and anti-CSRF header; logout revokes session',async()=>{
 const logged=await call('/auth/password/login',{body:{username:'farmer.local',password}}),cookie=logged.cookie.split(';')[0]
 const body={category:'CSRF测试',description:'本地安全测试'},key=randomUUID()
 assert.equal((await call('/help-tickets',{body,key,headers:{Cookie:cookie}})).status,403)
 assert.equal((await call('/help-tickets',{body,key,headers:{Cookie:cookie,Origin:'https://evil.example','X-XQ-Client':'web-v1'}})).status,403)
 assert.equal((await call('/help-tickets',{body,key,headers:{Cookie:cookie,Origin:'http://127.0.0.1:4199','X-XQ-Client':'web-v1'}})).status,200)
 await ok('/auth/logout',{token:logged.envelope.data.token,body:{}})
 assert.equal((await call('/users/me',{token:logged.envelope.data.token})).status,401)
})
