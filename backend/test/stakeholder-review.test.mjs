import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
const contract=JSON.parse(readFileSync(new URL('../../contracts/connected-data-v1.json',import.meta.url),'utf8'))
const base=process.env.XQ_TEST_API||'http://127.0.0.1:8080/api/v1',password=process.env.XQ_TEST_PASSWORD
if(!/^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/.test(base)||!password)throw Error('Only local API with explicit synthetic password is allowed')
const run=randomUUID().slice(0,8),sessions=[],users={};let admin,branch,plot,standard
async function call(path,{who,body,version,key,identity}={}){const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(who?{Authorization:'Bearer '+who.token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...(key?{'Idempotency-Key':key}:{}),...(version===undefined?{}:{'If-Match':String(version)}),...(identity?{'X-XQ-Identity':identity}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,data:await res.json()}}
async function ok(path,opts){const r=await call(path,opts);assert.equal(r.status,200,JSON.stringify(r.data));return r.data.data}
const write=(path,who,body,version,key=randomUUID())=>ok(path,{who,body,version,key})
async function login(username){const who=await ok('/auth/password/login',{body:{username,password}});sessions.push(who);return who}
async function switchTo(who,id){Object.assign(who,await ok('/identities/'+id+'/switch',{who,body:{}}))}
async function role(who,role){const q=await write('/identity-applications',who,{role,subjectName:'QA 审视 '+role+' '+run,address:'福建省 / 宁德市 / 福安市 / 赛岐镇 / 测试',reason:'仅本地软件权限测试，不代表已核验资质'});await write('/admin/identity-applications/'+q.id+'/review',admin,{approved:true},1);const me=await ok('/users/me',{who});await switchTo(who,me.identities.find(i=>i.role===role).id)}
async function planMember(who,fee,approved){const plan=await write('/admin/membership-plans',admin,{name:'QA 撤回 '+run,role:who.identities.find(i=>i.id===who.activeIdentityId).role,feeFen:fee,validDays:30}),q=await write('/memberships',who,{planId:plan.id,reason:'仅软件申请，不支付'});if(approved)return {...q,...await write('/admin/memberships/'+q.id+'/review',admin,{approved:true,reviewNote:'只登记审批结果，不虚构付款'},1)};return q}
async function demand(){return write('/service-requests',users.farmer,{plotId:plot.id,standardId:standard.id,scheduledDate:'2026-10-10'})}
before(async()=>{
 admin=await login('admin.local');await switchTo(admin,'identity-admin');branch=await write('/admin/centers',admin,{name:'QA 六方审视 '+run,countyCode:'350981'});await switchTo(admin,branch.adminIdentityId)
 for(const r of ['farmer','buyer','machine','team','supplier']){const who=await ok('/auth/local-register',{body:{username:'qa.review.'+run+'.'+r,password,name:'QA '+r,centerId:branch.id}});sessions.push(who);await role(who,r);users[r]=who}
 plot=await write('/plots',users.farmer,{name:'QA 撤回地块',areaMu:1.2,crop:'葡萄',address:'本地联调'});await write('/admin/plots/'+plot.id+'/verify',admin,{approved:true},1)
 standard=await write('/admin/service-standards',admin,{operation:'QA 巡田',criteria:'核对作业范围，独立验收；只作软件测试'})
})
test('role guidance is authenticated, identity-scoped and filtered by real permissions; supplier/government gaps stay explicit',async()=>{
 assert.equal((await call('/work-guidance')).status,401)
 for(const [r,who]of Object.entries(users)){
  const g=await ok('/work-guidance?role=center_admin',{who}),spec=contract.objects['/work-guidance'];assert.deepEqual(Object.keys(g).sort(),Object.keys(spec.fields).sort());assert.equal(g.role,r);assert.equal(g.identityId,who.activeIdentityId);assert.equal(g.version,'stakeholder-v1');assert.ok(g.steps.every(s=>!['centers','merchants','settlements','standards'].includes(s.module)))
  assert.ok(g.fees.every(f=>Number.isSafeInteger(f.feeFen)));assert.ok(g.steps.every(s=>typeof s.detail==='string'));assert.ok(g.limits.some(s=>s.includes('政府数据授权')))
  if(r==='farmer')assert.deepEqual(g.fees.map(f=>f.feeFen),[0,10000]);else assert.deepEqual(g.fees,[])
  if(r==='supplier'){assert.ok(g.checks.some(s=>s.includes('台账尚未接通')));assert.ok(!g.steps.some(s=>s.module==='records'||s.module==='orders'))}
 }
 const catalog=await ok('/role-catalog',{who:users.farmer});assert.ok(!catalog.some(r=>r.id==='government'),'government access must not be manufactured via admin permissions')
})
test('pending and awaiting-payment membership can be withdrawn, recorded, replayed and reapplied without fake refund',async()=>{
 for(const [fee,approved]of [[0,false],[49900,true]]){
  const q=await planMember(users.buyer,fee,approved),v=approved?2:1,key=randomUUID();let row=(await ok('/memberships',{who:users.buyer})).items.find(r=>r.id===q.id);assert.deepEqual(row.availableActions,['cancel'])
  assert.equal((await call('/memberships/'+q.id+'/cancel',{who:users.machine,body:{note:'越权'},version:v,key:randomUUID()})).status,404)
  assert.equal((await call('/memberships/'+q.id+'/cancel',{who:admin,body:{note:'不能代撤'},version:v,key:randomUUID()})).status,403)
  assert.equal((await call('/memberships/'+q.id+'/cancel',{who:users.buyer,body:{note:''},version:v,key:randomUUID()})).status,422)
  const note='QA 撤回原因 '+fee,result=await write('/memberships/'+q.id+'/cancel',users.buyer,{note},v,key);assert.equal(result.refundExecuted,false);assert.equal(result.status,'cancelled');assert.deepEqual(await write('/memberships/'+q.id+'/cancel',users.buyer,{note},v,key),result)
  assert.equal((await call('/admin/memberships/'+q.id+'/review',{who:admin,body:{approved:true,reviewNote:'不能再审批'},version:v,key:randomUUID()})).status,409)
  row=(await ok('/memberships',{who:users.buyer})).items.find(r=>r.id===q.id);assert.equal(row.cancellationNote,note);assert.match(row.cancelledAt,/Z$/);assert.equal(row.expiresAt,null);assert.deepEqual(row.availableActions,[]);assert.equal(row.feeFen,fee)
 }
})
test('active membership cannot be withdrawn, and switching identity cannot withdraw the original identity application',async()=>{
 const active=await planMember(users.machine,0,true);assert.equal((await call('/memberships/'+active.id+'/cancel',{who:users.machine,body:{note:'已生效'},version:2,key:randomUUID()})).status,409)
 const q=await planMember(users.buyer,0,false),original=users.buyer.activeIdentityId;await role(users.buyer,'machine')
 assert.equal((await call('/memberships/'+q.id+'/cancel',{who:users.buyer,body:{note:'旧身份'},identity:original,version:1,key:randomUUID()})).status,409)
 assert.equal((await call('/memberships/'+q.id+'/cancel',{who:users.buyer,body:{note:'另一身份'},version:1,key:randomUUID()})).status,404)
 await switchTo(users.buyer,original);await write('/memberships/'+q.id+'/cancel',users.buyer,{note:'恢复原身份后撤回'},1)
})
test('only the originating grower can cancel unclaimed service, with reasons, versions, evidence and no generated work order',async()=>{
 const q=await demand();let row=(await ok('/service-requests',{who:users.farmer})).items.find(r=>r.id===q.id);assert.deepEqual(row.availableActions,['cancel'])
 for(const who of [users.machine,admin])assert.equal((await call('/service-requests/'+q.id+'/cancel',{who,body:{note:'不能代取消'},version:1,key:randomUUID()})).status,403)
 const outsider=await login('other.local');assert.equal((await call('/service-requests/'+q.id+'/cancel',{who:outsider,body:{note:'跨中心'},version:1,key:randomUUID()})).status,404)
 assert.equal((await call('/service-requests/'+q.id+'/cancel',{who:users.farmer,body:{note:'无版本'},key:randomUUID()})).status,428)
 assert.equal((await call('/service-requests/'+q.id+'/cancel',{who:users.farmer,body:{note:'错误版本'},version:2,key:randomUUID()})).status,409)
 assert.equal((await call('/service-requests/'+q.id+'/cancel',{who:users.farmer,body:{note:' '},version:1,key:randomUUID()})).status,422)
 const key=randomUUID(),body={note:'QA 天气原因取消'},result=await write('/service-requests/'+q.id+'/cancel',users.farmer,body,1,key);assert.deepEqual(await write('/service-requests/'+q.id+'/cancel',users.farmer,body,1,key),result)
 assert.equal((await call('/service-requests/'+q.id+'/claim',{who:users.team,body:{},version:1,key:randomUUID()})).status,409)
 row=(await ok('/service-requests',{who:users.farmer})).items.find(r=>r.id===q.id);assert.equal(row.cancellationNote,body.note);assert.match(row.cancelledAt,/Z$/);assert.deepEqual(row.availableActions,[])
 assert.equal((await ok('/work-orders',{who:admin})).items.filter(r=>r.requestId===q.id).length,0)
})
test('claim/cancel race has exactly one winner and cannot cancel a claimed service, repeated five times',async()=>{
 for(let round=0;round<5;round++){
  const q=await demand(),outcomes=await Promise.all([call('/service-requests/'+q.id+'/claim',{who:users.machine,body:{},version:1,key:randomUUID()}),call('/service-requests/'+q.id+'/cancel',{who:users.farmer,body:{note:'QA 竞争取消'},version:1,key:randomUUID()})]);assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409])
  const row=(await ok('/service-requests',{who:users.farmer})).items.find(r=>r.id===q.id),orders=(await ok('/work-orders',{who:admin})).items.filter(r=>r.requestId===q.id);assert.equal(orders.length,row.status==='claimed'?1:0)
  if(row.status==='claimed')assert.equal((await call('/service-requests/'+q.id+'/cancel',{who:users.farmer,body:{note:'不能撤销已接单'},version:2,key:randomUUID()})).status,409)
 }
})
test('withdrawal actions preserve independent audits and expose camelCase nullable fields, not private actor columns',async()=>{
 const audit=await ok('/admin/audit-logs',{who:admin});assert.ok(audit.some(r=>r.action==='membership.cancel'));assert.ok(audit.some(r=>r.action==='service.cancel'))
 for(const [path,who,spec]of [['/memberships',users.buyer,contract.workflowLists['/memberships']],['/service-requests',users.farmer,contract.lists['/service-requests']]])for(const row of (await ok(path,{who})).items){assert.deepEqual(Object.keys(row).sort(),Object.keys(spec.fields).sort());assert.ok(row.cancellationNote===null||typeof row.cancellationNote==='string');assert.ok(row.cancelledAt===null||/Z$/.test(row.cancelledAt))}
})
after(async()=>{for(const who of sessions)await call('/auth/logout',{who,body:{}})})
