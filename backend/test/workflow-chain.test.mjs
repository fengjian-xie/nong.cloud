import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {writeFileSync,readFileSync} from 'node:fs'
const contracts=JSON.parse(readFileSync(new URL('../../contracts/connected-data-v1.json',import.meta.url),'utf8'))
const base=process.env.XQ_TEST_API||'http://127.0.0.1:8080/api/v1',password=process.env.XQ_TEST_PASSWORD
if(!/^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/.test(base)||!password)throw new Error('Only local API and synthetic local password are permitted')
const run=randomUUID().slice(0,8),sessions=[],evidence={run,mode:'local-software-only',paymentExecuted:false}
let root,admin,branch,grandchild,farmer,machine,buyer,paidBuyer,plot,card,stock,trade,settlement
async function call(path,{token,body,key,version,method,identity}={}){const res=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...(key?{'Idempotency-Key':key}:{}),...(version===undefined?{}:{'If-Match':String(version)}),...(identity?{'X-XQ-Identity':identity}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,data:await res.json()}}
async function ok(path,opts){const r=await call(path,opts);assert.equal(r.status,200,JSON.stringify(r.data));return r.data.data}
const write=(path,who,body,version,key=randomUUID())=>ok(path,{token:who.token,body,version,key})
async function login(username){const me=await ok('/auth/password/login',{body:{username,password}});sessions.push(me);return me}
async function switchTo(who,id){const me=await ok('/identities/'+id+'/switch',{token:who.token,body:{}});Object.assign(who,me);return me}
async function register(role){const username='qa.'+run+'.'+role;const who=await ok('/auth/local-register',{body:{username,password,name:'QA '+role+' '+run,centerId:branch.id,role:'center_admin'}});sessions.push(who);assert.equal(who.identities[0].role,'consumer');return {who,username}}
async function approveRole(who,role){const q=await write('/identity-applications',who,{role,subjectName:'QA '+role+' '+run,address:'福建省 / 宁德市 / 福安市 / 赛岐镇 / 本地测试',reason:'全链路准入测试；不是法定资质核验'});await write('/admin/identity-applications/'+q.id+'/review',admin,{approved:true},1);const me=await ok('/users/me',{token:who.token}),id=me.identities.find(i=>i.role===role).id;await switchTo(who,id);return id}
async function freeMember(who,role){const plan=await write('/admin/membership-plans',admin,{name:'QA 免费测试方案 '+run,role,feeFen:0,validDays:365}),q=await write('/memberships',who,{planId:plan.id,reason:'仅本地免费测试'});await write('/admin/memberships/'+q.id+'/review',admin,{approved:true,reviewNote:'只开通本地免费方案，不模拟收款'},1);return q.id}
before(async()=>{
 root=await login('admin.local');await switchTo(root,'identity-admin');
 branch=await write('/admin/centers',root,{name:'QA 分公司 '+run,countyCode:'350981',parentId:'local-other'});assert.equal(branch.parentId,'local-fuan');assert.equal(branch.legalRegistrationConfirmed,false);evidence.branchId=branch.id
 admin=await login('admin.local');await switchTo(admin,branch.adminIdentityId);
 grandchild=await write('/admin/centers',admin,{name:'QA 下级中心 '+run,countyCode:'350982'});
 for(const role of ['farmer','machine','buyer']){const {who,username}=await register(role);evidence[role+'Username']=username;if(role==='farmer')farmer=who;if(role==='machine')machine=who;if(role==='buyer')buyer=who;await approveRole(who,role)}
})
test('recursive centers preserve tenant isolation and ancestor suspension; account has no manufactured administrator role',async()=>{
 const tree=await ok('/admin/centers',{token:root.token});assert.ok(tree.some(c=>c.id===branch.id));assert.ok(tree.some(c=>c.id===grandchild.id));assert.ok(!tree.some(c=>c.id==='local-other'))
 assert.equal((await call('/admin/centers',{token:farmer.token})).status,403)
 await write('/admin/centers/'+branch.id+'/status',root,{active:false},1);assert.equal((await call('/users/me',{token:admin.token})).status,401)
 assert.equal((await call('/auth/local-register',{body:{username:'qa.'+run+'.suspended',password,name:'QA',centerId:grandchild.id}})).status,404)
 await write('/admin/centers/'+branch.id+'/status',root,{active:true},2);assert.equal((await ok('/users/me',{token:admin.token})).activeIdentityId,branch.adminIdentityId)
 assert.equal((await call('/admin/centers/local-other/status',{token:root.token,body:{active:false},version:1,key:randomUUID()})).status,404)
})
test('machine and buyer membership applications are independently approved; fee-bearing membership cannot fake payment',async()=>{
 await freeMember(machine,'machine');await freeMember(buyer,'buyer')
 assert.equal((await call('/admin/membership-plans',{token:admin.token,body:{name:'违法农户收费',role:'farmer',feeFen:100,validDays:365},key:randomUUID()})).status,422)
 const {who}=await register('paidbuyer');paidBuyer=who;await approveRole(paidBuyer,'buyer');const plan=await write('/admin/membership-plans',admin,{name:'QA 收费边界测试（不收款）',role:'buyer',feeFen:49900,validDays:365}),q=await write('/memberships',paidBuyer,{planId:plan.id,reason:'客户端paid字段不得生效',paymentStatus:'paid',feeFen:0})
 const reviewed=await write('/admin/memberships/'+q.id+'/review',admin,{approved:true,reviewNote:'支付未接通，只进入待付款'},1);assert.equal(reviewed.status,'awaiting_payment');const row=(await ok('/memberships',{token:paidBuyer.token})).items.find(m=>m.id===q.id);assert.equal(row.feeFen,49900);assert.equal(row.paymentStatus,'not_connected');assert.equal(row.expiresAt,null);assert.equal((await call('/stock-batches',{token:paidBuyer.token})).status,409)
})
test('new grower applies for 100-yuan card; role, plot, card configuration and evidence reread from PostgreSQL',async()=>{
 plot=await write('/plots',farmer,{name:'QA 葡萄地块 '+run,areaMu:1.5,crop:'葡萄',address:'福安市赛岐镇，本地测试'});await write('/admin/plots/'+plot.id+'/verify',admin,{approved:true},1);evidence.plotId=plot.id
 const q=await write('/card-requests',farmer,{kind:'issue',reason:'独立新种植户办卡测试',feeFen:0,paymentStatus:'paid'});assert.equal(q.feeFen,10000);await write('/admin/card-requests/'+q.id+'/review',admin,{approved:true,reviewNote:'只审核云端登记，不确认实物或付款'},1);const created=await write('/admin/card-requests/'+q.id+'/register',admin,{},2);card=created.newCardId;evidence.cardId=card;assert.equal(created.paymentStatus,'not_connected')
 await ok('/cards/'+card+'/configuration',{token:farmer.token,method:'PUT',body:{A:'修剪',B:'施肥',C:'巡田'},version:1,key:randomUUID()});const config=await ok('/cards/'+card+'/configuration',{token:farmer.token});assert.equal(config.configuration.A,'修剪');assert.equal(config.deviceConfirmed,false)
 const event={eventId:randomUUID(),button:'A',bindingVersion:1,configVersion:2,occurredAt:new Date().toISOString(),fixStatus:'failed'};await write('/cards/'+card+'/events',farmer,{events:[event]});const history=await ok('/cards/'+card+'/events',{token:farmer.token});assert.equal(history.items[0].operation,'修剪');assert.equal(history.items[0].hardwareAuthenticated,false)
 await write('/farm-activities',farmer,{plotId:plot.id,operation:'人工巡田',occurredAt:new Date().toISOString(),clientSeq:randomUUID(),note:'来源必须由服务端确认'});assert.equal((await ok('/farm-activities',{token:farmer.token})).items[0].source,'manual')
})
test('machine service runs request, claim, check-in, completion and independent grower acceptance against a frozen standard',async()=>{
 const standard=await write('/admin/service-standards',admin,{operation:'QA 葡萄机械除草',criteria:'按指定地块作业；种植户独立核对作业范围，不替代检测'}),q=await write('/service-requests',farmer,{plotId:plot.id,standardId:standard.id,scheduledDate:'2026-10-09'}),order=await write('/service-requests/'+q.id+'/claim',machine,{},1)
 await write('/work-orders/'+order.id+'/check-in',machine,{},1);await write('/work-orders/'+order.id+'/submit',machine,{note:'QA 作业完成，等待独立验收'},2);assert.equal((await call('/work-orders/'+order.id+'/accept',{token:machine.token,body:{note:'不能自验收'},version:3,key:randomUUID()})).status,403)
 await write('/work-orders/'+order.id+'/accept',farmer,{note:'QA 种植户独立验收'},3);const row=(await ok('/work-orders',{token:farmer.token})).items.find(o=>o.id===order.id);assert.equal(row.status,'accepted');assert.equal(row.acceptanceNote,'QA 种植户独立验收');assert.equal(row.qualityCertified,false);evidence.workOrderId=order.id
})
test('buyer reserves inventory once; quantities and frozen prices are numeric; overselling and forged center/price reject',async()=>{
 stock=await write('/stock-batches',farmer,{plotId:plot.id,grade:'B',quantityKg:100,unitPriceFenKg:101,product:'伪造产品'});assert.equal(stock.product,'葡萄');evidence.batchId=stock.id
 const body={batchId:stock.id,quantityKg:10.125,unitPriceFenKg:1,amountFen:1,centerId:'local-other'},key=randomUUID();trade=await write('/trade-orders',buyer,body,1,key);assert.deepEqual(await write('/trade-orders',buyer,body,1,key),trade);assert.equal(trade.amountFen,1023);evidence.tradeOrderId=trade.id
 assert.equal((await call('/trade-orders',{token:buyer.token,body:{batchId:stock.id,quantityKg:100},version:2,key:randomUUID()})).status,409)
 const row=(await ok('/stock-batches',{token:farmer.token})).items.find(b=>b.id===stock.id);assert.equal(row.reservedKg,10.125);assert.equal(row.availableKg,89.875);assert.equal(typeof row.quantityKg,'number')
 const other=await login('other.local');assert.equal((await call('/trade-orders/'+trade.id+'/handovers',{token:other.token})).status,404)
})
test('multi-party handover has independent confirmation; stale versions and state jumps reject; accepted stock reconciles',async()=>{
 assert.equal((await call('/trade-orders/'+trade.id+'/accept',{token:buyer.token,body:{note:'跳过发货'},version:1,key:randomUUID()})).status,403)
 await write('/trade-orders/'+trade.id+'/seller-confirm',farmer,{note:'QA 确認等级和数量'},1);await write('/trade-orders/'+trade.id+'/dispatch',farmer,{note:'QA 登记发货'},2)
 assert.equal((await call('/trade-orders/'+trade.id+'/accept',{token:farmer.token,body:{note:'卖方不能自验收'},version:3,key:randomUUID()})).status,403)
 await write('/trade-orders/'+trade.id+'/accept',buyer,{note:'QA 买方独立核对数量与等级'},3)
 assert.equal((await call('/trade-orders/'+trade.id+'/accept',{token:buyer.token,body:{note:'重复验收'},version:3,key:randomUUID()})).status,409)
 const handovers=await ok('/trade-orders/'+trade.id+'/handovers',{token:farmer.token});assert.deepEqual(handovers.items.map(r=>r.action),['seller-confirm','dispatch','accept']);assert.ok(handovers.items.every(r=>/Z$/.test(r.createdAt)))
 const row=(await ok('/stock-batches',{token:farmer.token})).items.find(b=>b.id===stock.id);assert.equal(row.reservedKg,0);assert.equal(row.soldKg,10.125)
})
test('stock reservation race has one winner; cancelled reservation returns quantity exactly',async()=>{
 for(let round=0;round<8;round++){
  const small=await write('/stock-batches',farmer,{plotId:plot.id,grade:'C',quantityKg:1,unitPriceFenKg:100}),req={token:buyer.token,body:{batchId:small.id,quantityKg:1},version:1};const outcomes=await Promise.all([call('/trade-orders',{...req,key:randomUUID()}),call('/trade-orders',{...req,key:randomUUID()})]);assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);const order=outcomes.find(r=>r.status===200).data.data;await write('/trade-orders/'+order.id+'/cancel',buyer,{note:'QA 取消退回库存'},1);const row=(await ok('/stock-batches',{token:farmer.token})).items.find(b=>b.id===small.id);assert.equal(row.availableKg,1);assert.equal(row.reservedKg,0)
 }
})
test('disputed delivery stays reserved and cannot become a settlement or unilateral staff acceptance',async()=>{
 const batch=await write('/stock-batches',farmer,{plotId:plot.id,grade:'争议边界',quantityKg:2,unitPriceFenKg:100}),o=await write('/trade-orders',buyer,{batchId:batch.id,quantityKg:1},1);await write('/trade-orders/'+o.id+'/seller-confirm',farmer,{note:'QA确认'},1);await write('/trade-orders/'+o.id+'/dispatch',farmer,{note:'QA发货'},2);await write('/trade-orders/'+o.id+'/dispute',buyer,{note:'QA数量争议，保留锁定待调解'},3)
 const row=(await ok('/stock-batches',{token:farmer.token})).items.find(b=>b.id===batch.id);assert.equal(row.reservedKg,1);assert.equal(row.soldKg,0)
 assert.equal((await call('/admin/settlement-plans',{token:admin.token,body:{orderId:o.id},key:randomUUID()})).status,409);assert.equal((await call('/trade-orders/'+o.id+'/accept',{token:admin.token,body:{note:'中心不能替双方验收'},version:4,key:randomUUID()})).status,403)
})
test('headquarters and branch settlement plans reconcile integer cents; no actual transfer or farmer service deduction',async()=>{
 const number='9'+String(Date.now()).slice(-9),head=await write('/admin/merchants',root,{displayName:'QA 总部未核验对象',subMchid:number}),local=await write('/admin/merchants',admin,{displayName:'QA 中心未核验对象',subMchid:String(BigInt(number)+1n)})
 settlement=await write('/admin/settlement-plans',admin,{orderId:trade.id,platformMerchantId:head.id,centerMerchantId:local.id,merchantServiceFeeFen:101,platformRateBps:3500});assert.equal(settlement.amountFen,101);assert.equal(settlement.platformAmountFen,35);assert.equal(settlement.centerAmountFen,66);assert.equal(settlement.externalExecuted,false);assert.equal(settlement.status,'blocked_external');evidence.settlementPlanId=settlement.id
 const row=(await ok('/admin/settlement-plans',{token:admin.token})).items.find(s=>s.id===settlement.id);assert.equal(row.sourceAmountFen,1023);assert.equal(row.producerServiceFeeFen,0);assert.equal(row.platformAmountFen+row.centerAmountFen,row.amountFen)
 assert.equal((await call('/admin/settlement-plans/'+settlement.id+'/execute',{token:admin.token,body:{}})).status,503)
 assert.equal((await call('/admin/settlement-plans',{token:buyer.token})).status,403);assert.equal((await call('/admin/merchants',{token:farmer.token})).status,403)
})
test('recursive return pass reads every independent identity and blocks stale-role writes',async()=>{
 const farmerIdentity=farmer.activeIdentityId;await approveRole(farmer,'machine');const stale=await call('/card-requests',{token:farmer.token,identity:farmerIdentity,body:{kind:'issue',reason:'过期身份'},key:randomUUID()});assert.equal(stale.status,409);await switchTo(farmer,farmerIdentity)
 assert.ok((await ok('/cards',{token:farmer.token})).items.some(c=>c.id===card));assert.ok((await ok('/trade-orders',{token:buyer.token})).items.some(o=>o.id===trade.id&&o.status==='accepted'));assert.ok((await ok('/admin/audit-logs',{token:admin.token})).some(a=>a.action==='settlement.plan'))
 const freshBuyer=await login(evidence.buyerUsername);assert.equal(freshBuyer.identities.find(i=>i.id===freshBuyer.activeIdentityId).role,'buyer');const freshAdmin=await login('admin.local');assert.equal(freshAdmin.activeIdentityId,'identity-admin')
})
test('new workflow lists match the shared executable camelCase, numeric, UTC and null contracts',async()=>{
 for(const [path,spec] of Object.entries(contracts.workflowLists)){
  const page=await ok(path+'?size=100',{token:(path==='/stock-batches'?farmer:path==='/trade-orders'?buyer:admin).token});assert.ok(page.items.length>0,path);assert.deepEqual(Object.keys(page).sort(),contracts.page.fields.slice().sort())
  for(const row of page.items){assert.deepEqual(Object.keys(row).sort(),Object.keys(spec.fields).sort(),path);for(const [key,raw] of Object.entries(spec.fields)){let kind=raw;if(kind.endsWith('?')&&row[key]===null)continue;kind=kind.replace(/\?$/,'');if(kind==='integer')assert.ok(Number.isSafeInteger(row[key]),key);else if(kind==='instant')assert.match(row[key],/^\d{4}-\d{2}-\d{2}T.*Z$/,key);else if(kind==='array')assert.ok(Array.isArray(row[key]),key);else assert.equal(typeof row[key],kind,key)}if(spec.statuses)assert.ok(spec.statuses.includes(row.status))}
 }
})
after(async()=>{if(process.env.XQ_QA_OUTPUT)writeFileSync(process.env.XQ_QA_OUTPUT,JSON.stringify(evidence,null,2));for(const s of sessions)await call('/auth/logout',{token:s.token,body:{}})})
