import {test,before} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const base=process.env.XQ_TEST_API||'http://127.0.0.1:8080/api/v1',password=process.env.XQ_TEST_PASSWORD
if(!/^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/.test(base)||!password)throw new Error('Only loopback and local test password are permitted')
let farmer,admin,other,provider
async function call(path,{token,body,version,key,method}={}){const r=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...(key?{'Idempotency-Key':key}:{}),...(version===undefined?{}:{'If-Match':String(version)})},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,envelope:await r.json()}}
async function ok(path,opts){const r=await call(path,opts);assert.equal(r.status,200,JSON.stringify(r.envelope));return r.envelope.data}
const write=(path,token,body,version,key=randomUUID())=>ok(path,{token,body,version,key})
async function issued(){const request=await write('/card-requests',farmer.token,{kind:'issue',reason:'软件闭环联调 '+randomUUID(),feeFen:1,paymentStatus:'paid'});await write('/admin/card-requests/'+request.id+'/review',admin.token,{approved:true,reviewNote:'仅测试软件申请，未确认收款、设备或实物'},1);const registered=await write('/admin/card-requests/'+request.id+'/register',admin.token,{},2);return registered.newCardId}
before(async()=>{for(const [name,set]of [['farmer.local',v=>farmer=v],['admin.local',v=>admin=v],['other.local',v=>other=v],['provider.local',v=>provider=v]])set(await ok('/auth/password/login',{body:{username:name,password}}));await ok('/identities/identity-farmer/switch',{token:farmer.token,body:{}});await ok('/identities/identity-provider/switch',{token:provider.token,body:{}})})
test('card application pins owner and 100 yuan quote; unapproved or another center cannot register',async()=>{
 const key=randomUUID(),body={kind:'issue',reason:'报价及权限测试',centerId:'local-other',subjectId:'subject-other',feeFen:0,paymentStatus:'paid'}
 const first=await write('/card-requests',farmer.token,body,undefined,key),again=await write('/card-requests',farmer.token,body,undefined,key);assert.deepEqual(first,again);assert.equal(first.feeFen,10000);assert.equal(first.paymentStatus,'not_connected')
 assert.equal((await call('/admin/card-requests/'+first.id+'/register',{token:admin.token,body:{},version:1,key:randomUUID()})).status,409)
 assert.equal((await call('/admin/card-requests/'+first.id+'/review',{token:farmer.token,body:{approved:true,reviewNote:'自审批'},version:1,key:randomUUID()})).status,403)
 assert.equal((await call('/card-requests',{token:provider.token,body:{kind:'issue',reason:'无权'},key:randomUUID()})).status,403)
 assert.ok(!(await ok('/card-requests',{token:other.token})).items.some(r=>r.id===first.id));await write('/card-requests/'+first.id+'/cancel',farmer.token,{},1)
})
test('registration is atomic and one-winner; hardware and actual payment remain unconfirmed',async()=>{
 const q=await write('/card-requests',farmer.token,{kind:'issue',reason:'云端登记竞争测试'});await write('/admin/card-requests/'+q.id+'/review',admin.token,{approved:true,reviewNote:'审核测试'},1)
 const outcomes=await Promise.all([1,2].map(()=>call('/admin/card-requests/'+q.id+'/register',{token:admin.token,body:{},version:2,key:randomUUID()})));assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);const result=outcomes.find(r=>r.status===200).envelope.data
 assert.equal(result.paymentStatus,'not_connected');assert.equal(result.physicalDeliveryConfirmed,false);assert.equal(result.hardwareAuthenticated,false)
 const card=(await ok('/cards?size=100',{token:farmer.token})).items.find(r=>r.id===result.newCardId);assert.equal(card.softwareOnly,true);assert.equal(card.acknowledgedConfigVersion,0);assert.equal(card.deviceConfirmed,false);assert.equal((await ok('/cards/'+card.id+'/binding-history',{token:farmer.token})).total,1)
})
test('configuration history freezes event meaning; loss prevents uploads and preserves original evidence',async()=>{
 const card=await issued(),config=await ok('/cards/'+card+'/configuration',{token:farmer.token}),event={eventId:randomUUID(),button:'A',bindingVersion:1,configVersion:1,occurredAt:new Date().toISOString(),fixStatus:'failed'}
 await write('/cards/'+card+'/events',farmer.token,{events:[event]});await ok('/cards/'+card+'/configuration',{token:farmer.token,body:{A:'新的作业',B:'灌溉',C:'巡田'},version:1,key:randomUUID(),method:'PUT'})
 const events=await ok('/cards/'+card+'/events',{token:farmer.token});assert.equal(events.items[0].operation,config.configuration.A);assert.equal(events.items[0].verificationStatus,'unverified');assert.equal(events.items[0].hardwareAuthenticated,false)
 assert.equal((await ok('/cards/'+card+'/configuration-history',{token:farmer.token})).total,2)
 await write('/cards/'+card+'/lifecycle/report-loss',farmer.token,{reason:'本地挂失测试'},1)
 assert.equal((await call('/cards/'+card+'/events',{token:farmer.token,body:{events:[event]},key:randomUUID()})).status,409)
 assert.equal((await ok('/cards/'+card+'/events',{token:farmer.token})).total,1)
 assert.equal((await call('/cards/'+card+'/binding-history',{token:other.token})).status,404)
})
test('replacement quote remains 100 yuan; one outstanding replacement; register retires old card but keeps its records',async()=>{
 const card=await issued();assert.equal((await call('/card-requests',{token:farmer.token,body:{kind:'replacement',oldCardId:card,reason:'未挂失'},key:randomUUID()})).status,409)
 await write('/cards/'+card+'/lifecycle/report-loss',farmer.token,{reason:'测试遗失'},1)
 const request=await write('/card-requests',farmer.token,{kind:'replacement',oldCardId:card,reason:'补卡联调',feeFen:0});assert.equal(request.feeFen,10000)
 assert.equal((await call('/card-requests',{token:farmer.token,body:{kind:'replacement',oldCardId:card,reason:'重复申请'},key:randomUUID()})).status,409)
 assert.equal((await call('/cards/'+card+'/lifecycle/restore',{token:admin.token,body:{reason:'尚有申请'},version:2,key:randomUUID()})).status,409)
 await write('/admin/card-requests/'+request.id+'/review',admin.token,{approved:true,reviewNote:'审核补卡'},1);const registered=await write('/admin/card-requests/'+request.id+'/register',admin.token,{},2)
 const rows=(await ok('/cards?size=100',{token:farmer.token})).items;assert.equal(rows.find(r=>r.id===card).status,'retired');assert.equal(rows.find(r=>r.id===registered.newCardId).status,'active');assert.equal((await ok('/cards/'+card+'/binding-history',{token:farmer.token})).total,3)
 assert.equal((await call('/cards/'+card+'/lifecycle/restore',{token:admin.token,body:{reason:'不可复活'},version:3,key:randomUUID()})).status,409)
})
test('cancelled replacement permits staff recovery; stale binding and stale lifecycle versions reject',async()=>{
 const card=await issued();await write('/cards/'+card+'/lifecycle/report-loss',farmer.token,{reason:'测试挂失'},1);const q=await write('/card-requests',farmer.token,{kind:'replacement',oldCardId:card,reason:'取消测试'});await write('/card-requests/'+q.id+'/cancel',farmer.token,{},1)
 assert.equal((await call('/cards/'+card+'/lifecycle/restore',{token:farmer.token,body:{reason:'无管理员权限'},version:2,key:randomUUID()})).status,403)
 const restored=await write('/cards/'+card+'/lifecycle/restore',admin.token,{reason:'已找到，仅恢复云端状态'},2);assert.equal(restored.bindingVersion,3)
 assert.equal((await call('/cards/'+card+'/events',{token:farmer.token,body:{events:[{eventId:randomUUID(),button:'A',bindingVersion:1,configVersion:1,occurredAt:new Date().toISOString(),fixStatus:'failed'}]},key:randomUUID()})).status,409)
 assert.equal((await call('/cards/'+card+'/lifecycle/report-loss',{token:farmer.token,body:{reason:'旧版本'},version:1,key:randomUUID()})).status,409)
})
