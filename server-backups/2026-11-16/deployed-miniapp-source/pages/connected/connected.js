const api = require('../../utils/connection')
const address = require('../../utils/address')
const definitions = [
 { id: 'plots', title: '地块档案', path: '/plots?size=100', permission: 'plots.read', write: 'plots.write', fields: ['name','areaMu','crop','address'] },
 { id: 'records', title: '农事记录', path: '/farm-activities', permission: 'records.read', write: 'records.write', fields: ['plotId','operation','note'] },
 { id: 'requests', title: '服务需求', path: '/service-requests', permission: 'services', write: 'services.request', fields: ['plotId','standardId','scheduledDate'] },
 { id: 'orders', title: '服务工单', path: '/work-orders', permission: 'services', fields: [] },
 { id: 'cards', title: '农事卡', path: '/cards', permission: 'cards.read', fields: [] },
 { id:'cardRequests',title:'办卡与补卡',path:'/card-requests',permission:'cards.request',write:'cards.request',fields:['kind','oldCardId','reason'] },
 { id: 'tickets', title: '帮助中心', path: '/help-tickets', permission: 'help.create', write: 'help.create', fields: ['category','description'] },
 { id: 'messages', title: '消息', path: '/messages', permission: 'messages.read', fields: [] },
 { id: 'applications', title: '添加身份', path: '/identity-applications', permission: 'application.create', write: 'application.create', fields: ['role','subjectName','address','reason'] },
 { id:'memberships',title:'会员申请',path:'/memberships',permission:'membership.read',write:'membership.apply',fields:['planId','reason'] },
 { id:'stock',title:'产品库存批次',path:'/stock-batches',permission:'trade.read',write:'stock.write',fields:['plotId','grade','quantityKg','unitPriceFenKg'] },
 { id:'trades',title:'采购与交接',path:'/trade-orders',permission:'trade.read',write:'trade.buy',fields:['batchId','quantityKg'] }
]
const labels = { name:'地块名称', areaMu:'面积（亩）', crop:'种植产品', address:'省市县乡镇及详细地址', plotId:'地块', plotName:'地块', operation:'作业内容', note:'记录说明', occurredAt:'作业时间（UTC）', source:'记录来源', standardId:'已发布执行标准', scheduledDate:'计划日期（YYYY-MM-DD）', category:'问题类别', description:'问题描述', role:'申请身份', subjectName:'主体名称', reason:'申请说明', reply:'中心回复', body:'消息正文', standardText:'执行标准', completionNote:'完工说明', acceptanceNote:'验收或争议说明', A:'A键作业', B:'B键作业', C:'C键作业' }
const states={pending:'待审核',verified:'已核验',rejected:'已驳回',open:'待处理',claimed:'已接单',working:'作业中',submitted:'待验收',accepted:'已验收',disputed:'有争议',processing:'处理中',resolved:'已回复',approved:'已批准',active:'有效',lost:'挂失'}
function allows(context,p) { return p==='services' ? context.permissions.some(x=>x.indexOf('services.')===0) : context.permissions.includes(p) }
function list(result) { return api.pageRows(result) }
Object.assign(labels,{kind:'申请类型',oldCardId:'已挂失原卡',newCardId:'新云端卡号',reviewNote:'审核说明'})
Object.assign(labels,{planId:'会员方案',grade:'等级（卖方自报）',quantityKg:'数量（千克）',unitPriceFenKg:'单价（分/千克）',batchId:'可见库存批次',amountFen:'订单金额',feeFen:'会员费用',availableKg:'可用库存（千克）',expiresAt:'会员到期时间',cancellationNote:'撤回/取消原因',cancelledAt:'撤回/取消时间（UTC）'})
Object.assign(states,{awaiting_payment:'待付款，未生效',reserved:'库存已锁定',seller_confirmed:'卖方已确认',dispatched:'已发货待验收',cancelled:'已取消'})
function describe(row) { return ['crop','areaMu','address','plotName','scheduledDate','occurredAt','source','note','description','reply','body','reason','standardText','completionNote','acceptanceNote','reviewNote','cancellationNote','cancelledAt','oldCardId','newCardId','grade','quantityKg','unitPriceFenKg','availableKg','amountFen','feeFen','expiresAt'].filter(k=>row[k]!=null&&row[k]!=='').map(k=>(k==='feeFen'&&row.kind?'办卡/补卡报价':labels[k]||k)+'：'+(k==='source'&&row[k]==='manual'?'人工记录':['amountFen','feeFen'].includes(k)?(Number(row[k])/100).toFixed(2)+'元':row[k])).join(' · ') }
function validGuidance(g,identity){return !!g&&g.version==='stakeholder-v1'&&g.identityId===identity&&typeof g.role==='string'&&typeof g.title==='string'&&Array.isArray(g.steps)&&g.steps.every(s=>s&&typeof s.module==='string'&&typeof s.title==='string'&&typeof s.detail==='string')&&Array.isArray(g.checks)&&g.checks.every(s=>typeof s==='string')&&Array.isArray(g.limits)&&g.limits.every(s=>typeof s==='string')&&Array.isArray(g.fees)&&g.fees.every(f=>f&&typeof f.label==='string'&&Number.isSafeInteger(f.feeFen)&&f.feeFen>=0&&typeof f.note==='string')}
Page({
 data: { context:null, modules:[], moduleTitles:[], moduleIndex:0, active:null, rows:[], fields:[], form:{}, busy:false, error:'', notice:'', actionNote:'', cardId:'',detailsId:'',detailRows:[],detailPage:1,detailTotal:0,detailHasNext:false,canCreate:false, guidance:null,guidanceError:'',guideExpanded:false, page:1,total:0,hasNext:false,pageSize:20,region:['福建省','宁德市','福安市'], regionChosen:false,towns:address.townships(['福建省','宁德市','福安市']),townIndex:-1,detailAddress:'' },
 onLoad(query) { this.requested = query.module || ''; this.pending = null },
 onShow() { this.refresh() },
 onUnload() {this.loadGeneration=(this.loadGeneration||0)+1},
 async refresh() {
  const generation=this.loadGeneration=(this.loadGeneration||0)+1
  this.setData({ busy:true,error:'',rows:[],total:0,hasNext:false,guidance:null,guidanceError:'' })
  try {
   const context = await api.refresh(); if(generation!==this.loadGeneration)return;if (!context) {this.setData({context:null,rows:[],fields:[],canCreate:false});return wx.navigateTo({ url:'/pages/login/login' })}
   const modules=definitions.filter(m=>allows(context,m.permission)), index=this.requested?modules.findIndex(m=>m.id===this.requested):0,active=modules[index]
   this.setData({ context,modules,moduleTitles:['请选择已接通模块',...modules.map(m=>m.title)],moduleIndex:index+1,active:active||null,fields:[],form:{},cardId:'',detailsId:'',detailRows:[],canCreate:false,regionChosen:false,townIndex:-1,detailAddress:'' }); this.pending=null
   if (!active) {this.setData({error:definitions.some(m=>m.id===this.requested)?'当前身份无权访问此模块，请切换已批准身份。':'此模块尚未接入数据库，不能跳到不相关业务或展示演示草稿。'});return}
   const identity=context.identity.id, jobs=[api.request(api.listPath(active.path,this.data.page,this.data.pageSize))]
   const needsPlots=active.fields.includes('plotId')&&allows(context,'plots.read'), needsStandards=active.fields.includes('standardId'), needsRoles=active.fields.includes('role')
   if(needsPlots) jobs.push(api.request('/plots?size=100'))
   if(needsStandards) jobs.push(api.request('/service-standards'))
   if(needsRoles) jobs.push(api.request('/role-catalog'))
   if(active.id==='cardRequests')jobs.push(api.request('/cards?size=100'))
   if(active.id==='memberships')jobs.push(api.request('/membership-plans?size=100'))
   if(active.id==='trades'&&allows(context,'trade.buy'))jobs.push(api.request('/stock-batches?size=100'))
   // Guidance failure must not hide persisted business records; load independently.
   api.request('/work-guidance').then(g=>{
    if(generation!==this.loadGeneration||!api.context()||api.context().identity.id!==identity)return
    if(!validGuidance(g,identity))throw new Error('指引身份或格式不匹配')
    this.setData({guidance:Object.assign({},g,{fees:g.fees.map(f=>Object.assign({},f,{amountText:(f.feeFen/100).toFixed(2)}))}),guidanceError:''})
   }).catch(()=>{if(generation===this.loadGeneration&&api.context()&&api.context().identity.id===identity)this.setData({guidance:null,guidanceError:'办事指引暂不可用，不影响业务记录；不会展示其他身份的指引。'})})
   const results=await Promise.all(jobs)
   if(generation!==this.loadGeneration||!api.context()||api.context().identity.id!==identity)return
   let at=1;const plots=needsPlots?list(results[at++]):[], standards=needsStandards?results[at++]:[], roles=needsRoles?results[at++]:[]
   const fields=active.fields.map(id=>{
    const choices=id==='planId'?list(results[1]):id==='batchId'&&results[1]?list(results[1]).filter(b=>Number(b.availableKg)>0).map(b=>Object.assign({},b,{name:b.product+' · '+b.grade+' · 可用'+b.availableKg+'千克 · '+b.id})):id==='kind'?[{id:'issue',name:'办卡（100元/张）'},{id:'replacement',name:'补卡（100元/张；先挂失）'}]:id==='oldCardId'?list(results[1]).filter(c=>c.status==='lost').map(c=>({id:c.id,name:c.id})):id==='plotId'?plots.filter(p=>!['requests','stock'].includes(active.id)||p.status==='verified'):id==='standardId'?standards.map(s=>({id:s.id,name:s.operation+' · V'+s.revision})):id==='role'?roles:[]
    return {id,label:labels[id],choices,choiceLabels:['请选择',...choices.map(c=>c.name)],choiceIndex:0,select:['plotId','standardId','role','kind','oldCardId','planId','batchId'].includes(id),multiline:['note','description','reason'].includes(id),isAddress:id==='address'}
   })
   const rows=list(results[0]).map(row=>{const actions=Array.isArray(row.availableActions)?row.availableActions:[];return Object.assign({},row,{heading:row.name||row.title||row.operation||row.subjectName||row.category||row.id,statusText:states[row.status]||(row.read===false?'未读':row.read===true?'已读':'数据库记录'),summary:describe(row),canClaim:active.id==='requests'&&actions.includes('claim'),canStart:active.id==='orders'&&actions.includes('check-in'),canSubmit:active.id==='orders'&&actions.includes('submit'),canAccept:active.id==='orders'&&actions.includes('accept'),canRead:active.id==='messages'&&!row.read,canConfigure:active.id==='cards'&&row.status==='active'&&allows(context,'cards.configure'),configurationSummary:row.configuration?['A','B','C'].map(k=>k+'键：'+row.configuration[k]).join(' · '):''})})
   rows.forEach(row=>{const actions=row.availableActions||[];row.canLose=active.id==='cards'&&actions.includes('report-loss');row.canCancel=active.id==='cardRequests'&&actions.includes('cancel');row.canWithdraw=['memberships','requests'].includes(active.id)&&actions.includes('cancel');row.tradeActions=active.id==='trades'?[['seller-confirm','卖方确认'],['dispatch','登记发货'],['accept','买方验收'],['dispute','提出交接争议'],['cancel','取消采购']].filter(a=>actions.includes(a[0])).map(a=>({id:a[0],label:a[1]})):[];if(row.kind)row.heading=row.kind==='issue'?'办卡申请':'补卡申请';if(row.status==='cloud_registered')row.statusText='已云端登记';if(row.status==='retired')row.statusText='已停用';if(row.status==='cancelled')row.statusText='已取消';if(row.expired)row.statusText='已过期'})
   this.setData({rows,fields,total:results[0].total,hasNext:results[0].hasNext,canCreate:!!active.write&&allows(context,active.write)})
  } catch(e) { if(generation===this.loadGeneration){this.setData({error:e.message+(e.traceId?' · '+e.traceId:'')});if(e.status===401)this.setData({context:null,rows:[],canCreate:false})} } finally {if(generation===this.loadGeneration)this.setData({busy:false})}
 },
 moduleChanged(e) { if(this.data.busy)return;const selected=this.data.modules[Number(e.detail.value)-1];if(!selected)return;this.requested=selected.id;this.setData({page:1,notice:'',actionNote:''});this.refresh() },
 switchChanged() {this.setData({page:1,notice:'',actionNote:''});this.refresh()},
 previousPage() {if(!this.data.busy&&this.data.page>1){this.setData({page:this.data.page-1});this.refresh()}},
 nextPage() {if(!this.data.busy&&this.data.hasNext){this.setData({page:this.data.page+1});this.refresh()}},
 edit(e) { this.setData({form:Object.assign({},this.data.form,{[e.currentTarget.dataset.field]:e.detail.value})}) },
 choice(e) { const id=e.currentTarget.dataset.field,index=Number(e.detail.value),field=this.data.fields.find(f=>f.id===id);this.setData({fields:this.data.fields.map(f=>f.id===id?Object.assign({},f,{choiceIndex:index}):f),form:Object.assign({},this.data.form,{[id]:index>0?field.choices[index-1].id:''})}) },
 note(e) {this.setData({actionNote:e.detail.value})},
 toggleGuide(){this.setData({guideExpanded:!this.data.guideExpanded})},
 withdraw(e){
  const active=this.data.active,row=this.data.rows.find(r=>r.id===e.currentTarget.dataset.id),note=this.data.actionNote.trim()
  if(this.data.busy||!active||!['memberships','requests'].includes(active.id)||!row||!row.canWithdraw)return
  if(!note)return this.setData({error:'请先填写撤回或取消原因。'})
  const scope=api.context()&&api.context().identity.id,path=(active.id==='memberships'?'/memberships/':'/service-requests/')+encodeURIComponent(row.id)+'/cancel'
  wx.showModal({title:active.id==='memberships'?'撤回会员申请':'取消未接单需求',content:'仅撤回当前身份自己发起且允许取消的记录，不等于退款，不会取消已接单工单。',success:r=>{if(r.confirm)this.write(path,{note},row.version,undefined,scope)}})
 },
 regionChange(e) {const region=e.detail.value;if(!Array.isArray(region)||region.length!==3)return;this.setData({region,regionChosen:true,towns:address.townships(region),townIndex:-1,form:Object.assign({},this.data.form,{address:''})})},
 townChange(e) {this.setData({townIndex:Number(e.detail.value)});this.composeAddress()},
 detailChange(e) {this.setData({detailAddress:e.detail.value});this.composeAddress()},
 composeAddress() {const town=this.data.towns[this.data.townIndex],valid=this.data.regionChosen&&address.validTown(this.data.region,town)&&this.data.detailAddress.trim();this.setData({form:Object.assign({},this.data.form,{address:valid?this.data.region.join(' / ')+' / '+town+' / '+this.data.detailAddress.trim():''})})},
 async write(path,body,version,method,expectedScope) {
  if(this.data.busy)return
  const scope=api.context()&&api.context().identity.id, fingerprint=JSON.stringify([scope,path,body,version,method])
  if(!scope||(expectedScope&&expectedScope!==scope))return this.setData({error:'身份已改变，请重新选择记录并确认。'})
  if(!this.pending||this.pending.fingerprint!==fingerprint)this.pending={fingerprint,key:api.key()}
  this.setData({busy:true,error:'',notice:''})
  try {await api.request(path,{method:method||'POST',body,key:this.pending.key,version,identity:scope});this.pending=null;if(api.context()&&api.context().identity.id===scope){this.setData({page:1});await this.refresh();this.setData({notice:'服务端已确认保存。',actionNote:''})}} catch(e){this.setData({error:e.message+(e.traceId?' · '+e.traceId:'')});if(e.errorCode==='XQ-IDENTITY-409'){try{await api.refresh()}catch(refreshError){this.setData({error:refreshError.message})}this.setData({rows:[],form:{},cardId:'',notice:'服务端身份已变化，请刷新后重新确认。'})}if(e.status===401)this.setData({context:null,rows:[],canCreate:false})}finally{this.setData({busy:false})}
 },
 submit() {
  const active=this.data.active,body=Object.assign({},this.data.form)
  if(!this.data.canCreate)return
  for(const field of ['areaMu','quantityKg','unitPriceFenKg'])if(body[field]!==undefined)body[field]=Number(body[field])
  if(active.id==='records') {body.clientSeq=body.clientSeq||api.key();body.occurredAt=body.occurredAt||new Date().toISOString();this.setData({form:body})}
  if(active.id==='cardRequests'&&body.kind==='issue')delete body.oldCardId
  if(active.id==='trades'){const field=this.data.fields.find(f=>f.id==='batchId'),batch=field&&field.choices.find(b=>b.id===body.batchId);if(!batch)return this.setData({error:'请选择可见库存批次'});return this.write('/trade-orders',body,batch.version)}
  this.write(active.path.split('?')[0],body)
 },
 tradeAction(e){const row=this.data.rows.find(r=>r.id===e.currentTarget.dataset.id),action=e.currentTarget.dataset.action,note=this.data.actionNote.trim();if(!row||!(row.availableActions||[]).includes(action))return;if(!note)return this.setData({error:'请先填写交接或争议说明。'});const scope=api.context()&&api.context().identity.id;wx.showModal({title:'确认采购交接记录',content:'只登记当前主体的履约动作；不代表付款、质量认证或真实运输。',success:r=>{if(r.confirm)this.write('/trade-orders/'+row.id+'/'+action,{note},row.version,undefined,scope)}})},
 async tradeHistory(e){const row=this.data.rows.find(r=>r.id===e.currentTarget.dataset.id),scope=api.context()&&api.context().identity.id;if(!row||this.data.busy)return;this.setData({busy:true,error:''});try{const data=await api.request('/trade-orders/'+row.id+'/handovers?size=100');if(api.context()&&api.context().identity.id===scope)this.setData({detailsId:row.id,detailsKind:'handovers',detailPage:1,detailTotal:data.total,detailHasNext:false,detailRows:list(data).map(r=>({id:r.id,heading:r.action,summary:r.note,at:r.createdAt}))})}catch(e){this.setData({error:e.message})}finally{this.setData({busy:false})}},
 action(e) {
  const row=this.data.rows.find(r=>r.id===e.currentTarget.dataset.id),action=e.currentTarget.dataset.action, note=this.data.actionNote.trim()
  if(!row)return
  if(['submit','accept','dispute'].includes(action)&&!note)return this.setData({error:'请先填写执行或验收说明。'})
  if(action==='report-loss'&&!note)return this.setData({error:'请填写挂失原因。'})
  const path=action==='report-loss'?'/cards/'+row.id+'/lifecycle/report-loss':action==='cancel'?'/card-requests/'+row.id+'/cancel':action==='claim'?'/service-requests/'+row.id+'/claim':action==='read'?'/messages/'+row.id+'/read':'/work-orders/'+row.id+'/'+action
  const scope=api.context()&&api.context().identity.id
  wx.showModal({title:'确认写入本地数据库',content:'执行此操作将改变服务端记录；不代表收款、实物交付、设备确认或质量认证。',success:r=>{if(r.confirm)this.write(path,action==='report-loss'?{reason:note}:note?{note}:{},action==='read'?undefined:row.version,undefined,scope)}})
 },
 configure(e) {const row=this.data.rows.find(r=>r.id===e.currentTarget.dataset.id);if(!row)return;this.cardVersion=row.desiredConfigVersion;this.setData({cardId:row.id,form:Object.assign({},row.configuration)})},
 saveConfiguration() {this.write('/cards/'+this.data.cardId+'/configuration',this.data.form,this.cardVersion,'PUT')},
 async history(e) {const row=this.data.rows.find(r=>r.id===e.currentTarget.dataset.id);if(!row)return;await this.loadHistory(row.id,e.currentTarget.dataset.kind,1)},
 async loadHistory(id,kind,page) {
  if(!['events','configuration-history','binding-history'].includes(kind)||this.data.busy)return
  const context=api.context(),generation=this.loadGeneration;if(!context)return
  this.setData({busy:true,error:''})
  try{const result=await api.request('/cards/'+encodeURIComponent(id)+'/'+kind+'?page='+page+'&size=10');if(generation!==this.loadGeneration||!api.context()||api.context().identity.id!==context.identity.id)return
   this.setData({detailsId:id,detailsKind:kind,detailPage:page,detailTotal:result.total,detailHasNext:result.hasNext,detailRows:list(result).map(row=>({id:row.id,heading:row.operation||(kind==='configuration-history'?'云端配置 V'+row.version:'绑定 V'+row.bindingVersion),summary:kind==='configuration-history'?['A','B','C'].map(k=>k+'：'+(row.configuration[k]||'未设置')).join(' · '):kind==='events'?'未验证采集证据 · 配置 V'+row.configVersion+' · '+row.occurredAt:row.reason,at:row.createdAt||row.receivedAt}))})
  }catch(e){this.setData({error:e.message})}finally{this.setData({busy:false})}
 },
 detailPrevious(){if(this.data.detailPage>1)this.loadHistory(this.data.detailsId,this.data.detailsKind,this.data.detailPage-1)},
 detailNext(){if(this.data.detailHasNext)this.loadHistory(this.data.detailsId,this.data.detailsKind,this.data.detailPage+1)},
 openLogin() {wx.reLaunch({url:'/pages/login/login'})},
 async logout() {this.setData({busy:true});try{await api.logout();this.setData({context:null,rows:[]});wx.reLaunch({url:'/pages/login/login'})}catch(e){this.setData({error:e.message})}finally{this.setData({busy:false})}}
})
