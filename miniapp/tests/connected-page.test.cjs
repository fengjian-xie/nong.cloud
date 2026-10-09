const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')
const source=fs.readFileSync(require.resolve('../pages/connected/connected.js'),'utf8')
function setup(module,permissions,response){
 const context={account:{name:'本地测试'},identity:{id:'i1',org:'测试主体'},permissions},calls=[];let spec
 const api={context:()=>context,refresh:async()=>context,key:()=>String(Date.now()),listPath:(p,n)=>p.split('?')[0]+'?page='+n+'&size=20',pageRows:d=>Array.isArray(d)?d:d.items,request:async p=>{calls.push(p);return response(p)}}
 vm.runInNewContext(source,{Page:v=>spec=v,require:p=>p.endsWith('/connection')?api:{townships:()=>['赛岐镇'],validTown:()=>true},wx:{navigateTo(){}}})
 const page={...spec,data:structuredClone(spec.data),setData(v){Object.assign(this.data,v)}};page.onLoad({module});return {page,calls,api}
}
const pagination=items=>({items,total:21,page:1,size:20,hasNext:true})
test('connected card screen reads current ABC and prepopulates the persisted configuration',async()=>{
 const {page}=setup('cards',['cards.read','cards.configure'],()=>pagination([{id:'card',status:'active',configuration:{A:'修剪',B:'灌溉',C:'巡田'},desiredConfigVersion:4,acknowledgedConfigVersion:0}]))
 await page.refresh();assert.equal(page.data.total,21);assert.equal(page.data.hasNext,true);assert.match(page.data.rows[0].configurationSummary,/A键：修剪/);page.configure({currentTarget:{dataset:{id:'card'}}});assert.deepEqual({...page.data.form},{A:'修剪',B:'灌溉',C:'巡田'});assert.equal(page.cardVersion,4)
})
test('order controls depend on server availableActions rather than role or state alone',async()=>{
 const {page}=setup('orders',['services.claim'],()=>pagination([{id:'o',status:'claimed',availableActions:[],acceptanceNote:'另一主体的验收说明',plotName:'葡萄地块'}]))
 await page.refresh();assert.equal(page.data.rows[0].canStart,false);assert.equal(page.data.rows[0].canSubmit,false);assert.match(page.data.rows[0].summary,/验收或争议说明/)
})
test('manual record screen retains actual time, source and notes instead of dropping fields',async()=>{
 const {page,calls}=setup('records',['records.read','records.write'],p=>p.startsWith('/plots')?pagination([{id:'p',name:'地块'}]):pagination([{id:'f',occurredAt:'2026-10-07T01:00:00Z',operation:'巡田',source:'manual',note:'数据库说明'}]))
 await page.refresh();assert.ok(calls.includes('/farm-activities?page=1&size=20'));assert.match(page.data.rows[0].summary,/数据库说明/);assert.match(page.data.rows[0].summary,/人工记录/);assert.match(page.data.rows[0].summary,/2026-10-07T01:00:00Z/)
})
test('a late old module response cannot overwrite a newer screen with the same identity',async()=>{
 let resolveOld,markStarted;const started=new Promise(resolve=>markStarted=resolve)
 const {page,api}=setup('orders',['services.claim','cards.read'],()=>pagination([{id:'card',status:'active',configuration:{A:'A',B:'B',C:'C'}}]))
 const request=api.request;api.request=p=>p.startsWith('/work-orders')?new Promise(resolve=>{resolveOld=resolve;markStarted()}):request(p)
 const first=page.refresh();await started;page.requested='cards';await page.refresh();resolveOld(pagination([{id:'old-order',status:'claimed',availableActions:['check-in']}]));await first;assert.equal(page.data.active.id,'cards');assert.equal(page.data.rows[0].id,'card')
})
test('unsupported farm/value modules and forbidden identities never fall back to unrelated data',async()=>{const unsupported=setup('cloudFarm',['plots.read'],()=>pagination([]));await unsupported.page.refresh();assert.equal(unsupported.page.data.active,null);assert.equal(unsupported.calls.length,0);assert.match(unsupported.page.data.error,/尚未接入/);const forbidden=setup('plots',['services.claim'],()=>pagination([]));await forbidden.page.refresh();assert.equal(forbidden.page.data.active,null);assert.equal(forbidden.calls.length,0);assert.match(forbidden.page.data.error,/无权访问/)})
test('card issue form binds software request fields without a mock payment or mandatory old card',async()=>{const {page}=setup('cardRequests',['cards.request'],p=>p.startsWith('/cards')?pagination([{id:'old',status:'lost'}]):pagination([{id:'q',kind:'issue',status:'pending',feeFen:10000,availableActions:['cancel']} ]));await page.refresh();assert.equal(page.data.canCreate,true);assert.equal(page.data.rows[0].canCancel,true);assert.deepEqual(Array.from(page.data.fields,f=>f.id),['kind','oldCardId','reason']);assert.equal(page.data.fields.find(f=>f.id==='oldCardId').choices[0].id,'old')})
test('buyer stock reads do not accidentally request private plots or allow a grower-only create form',async()=>{const {page,calls}=setup('stock',['trade.read','trade.buy'],()=>pagination([{id:'b',product:'葡萄',availableKg:2.5,quantityKg:3,unitPriceFenKg:100}]));await page.refresh();assert.equal(page.data.canCreate,false);assert.ok(!calls.some(p=>p.startsWith('/plots')));assert.match(page.data.rows[0].summary,/2.5/)})
test('membership uses approved server plans and does not enable pending payment locally',async()=>{const {page}=setup('memberships',['membership.read','membership.apply'],p=>p.startsWith('/membership-plans')?pagination([{id:'plan',name:'真实方案'}]):pagination([{id:'m',name:'真实方案',status:'awaiting_payment',feeFen:49900}]));await page.refresh();assert.equal(page.data.fields[0].choices[0].id,'plan');assert.match(page.data.rows[0].statusText,/未生效/);assert.match(page.data.rows[0].summary,/499.00元/)})
test('finance and branch management cannot enter the miniapp database module catalog',async()=>{for(const module of ['merchants','settlements','centers']){const {page,calls}=setup(module,['finance.manage','branches.manage'],()=>pagination([]));await page.refresh();assert.equal(page.data.active,null);assert.equal(calls.length,0)}})
test('the 100 yuan card quote is not mislabeled as a grower platform membership fee',async()=>{const {page}=setup('cardRequests',['cards.request'],p=>p.startsWith('/cards')?pagination([]):pagination([{id:'q',kind:'issue',feeFen:10000,status:'cloud_registered'}]));await page.refresh();assert.match(page.data.rows[0].summary,/办卡\/补卡报价：100.00元/);assert.doesNotMatch(page.data.rows[0].summary,/会员费用/)})
const guide={version:'stakeholder-v1',identityId:'i1',role:'farmer',title:'当前种植户',steps:[],checks:['独立验收'],limits:['不授予权限'],fees:[{label:'平台免费',feeFen:0,note:'免费'},{label:'卡片报价',feeFen:10000,note:'不代表收款'}]}
test('miniapp renders the same role guide and separates zero platform fee from 100 yuan quote',async()=>{
 const {page}=setup('cards',['cards.read'],p=>p==='/work-guidance'?guide:pagination([]));await page.refresh();assert.equal(page.data.guidance.title,'当前种植户');assert.deepEqual(Array.from(page.data.guidance.fees,f=>f.amountText),['0.00','100.00']);page.toggleGuide();assert.equal(page.data.guideExpanded,true)
})
test('unavailable or delayed guide does not block business reads or resurrect a previous screen',async()=>{
 let old;const {page}=setup('cards',['cards.read'],p=>p==='/work-guidance'?new Promise(r=>{old=r}):pagination([{id:'c',status:'active'}]));await page.refresh();assert.equal(page.data.rows[0].id,'c');assert.equal(page.data.guidance,null);page.onUnload();old(guide);await new Promise(r=>setImmediate(r));assert.equal(page.data.guidance,null)
 const malformed=setup('cards',['cards.read'],p=>p==='/work-guidance'?{...guide,identityId:'other'}:pagination([{id:'c'}]));await malformed.page.refresh();await new Promise(r=>setImmediate(r));assert.equal(malformed.page.data.rows[0].id,'c');assert.match(malformed.page.data.guidanceError,/暂不可用/)
})
test('withdrawal controls come from availableActions and cancellation evidence remains readable',async()=>{
 const {page}=setup('memberships',['membership.read','membership.apply'],p=>p.startsWith('/membership-plans')?pagination([]):pagination([{id:'a',status:'awaiting_payment',availableActions:['cancel']},{id:'b',status:'pending',availableActions:[]},{id:'c',status:'cancelled',availableActions:[],cancellationNote:'不再需要',cancelledAt:'2026-10-08T00:00:00Z'}]));await page.refresh();assert.equal(page.data.rows[0].canWithdraw,true);assert.equal(page.data.rows[1].canWithdraw,false);assert.equal(page.data.rows[2].canWithdraw,false);assert.match(page.data.rows[2].summary,/不再需要/);page.withdraw({currentTarget:{dataset:{id:'a'}}});assert.match(page.data.error,/填写撤回/)
})
