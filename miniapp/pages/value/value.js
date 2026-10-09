const session=require('../../utils/session'), value=require('../../utils/value-data'), catalog=require('../../utils/catalog'), business=require('../../utils/business-groups')
const moneyFields=new Set(Object.keys(value.incomeLabels))
Page({
 data:{context:null,view:'passport',title:'产品批次履历',tabs:[],rows:[],fields:[],drafts:[],notice:'',error:'',blocked:false,consent:false,publicConsent:false,note:'采收、分级和交接待实物核对（示例）',passportStatus:'本地草稿',storyText:'',incomeResult:null,gradeProduct:'葡萄',gradeOptions:['A级','B级','C级'],gradeIndex:1,quantity:'2000',unitOptions:['斤','kg'],unitIndex:0,matchResult:null,description:'',followed:false},
 onLoad(query){this.requested=query.view||'passport';this.refresh()},
 onShow(){if(this.requested)this.refresh()},
 refresh(){
  if(require('../../utils/connection').enabled())return wx.redirectTo({url:'/pages/connected/connected?module='+encodeURIComponent('value-'+this.requested)})
  const context=session.current(),role=context?context.identity.role:'',allowed=context?value.views(role):value.publicViews,view=this.requested
  if(!Object.prototype.hasOwnProperty.call(value.titles,view)||!allowed.includes(view)){this.setData({context,blocked:true,error:'此身份不可查看该模块，请选择已绑定身份。',drafts:[],fields:[],rows:[]});return}
  this.context=context
  let saved={};try{saved=context?session.read('value-loop-v1',{}):{}}catch{saved={}}
  if(!saved||saved.version!==1||!Array.isArray(saved.drafts)||saved.drafts.length>200||saved.drafts.some(d=>!d||typeof d.view!=='string'||typeof d.text!=='string'||d.text.length>2000||typeof d.at!=='string'))saved={version:1,drafts:[]}
  this.saved=saved
  const input=saved.income||value.initialIncome
  const related=context?business.related(catalog.modules(role),'value-'+view):allowed.filter(id=>['passport','calendar'].includes(id)).map(id=>({id:'value-'+id,title:value.titles[id]}))
  this.setData({context,view,title:value.titles[view],tabs:related,rows:value.sample[view].map(([label,copy])=>({label,copy})),blocked:false,error:'',notice:'',drafts:saved.drafts.filter(d=>d.view===view),fields:Object.entries(value.incomeLabels).map(([id,label])=>({id,label,value:typeof input[id]==='string'?input[id]:value.initialIncome[id]})),passportStatus:saved.passportStatus||'本地草稿',publicConsent:false,consent:false,storyText:'',incomeResult:null,matchResult:null,description:'',followed:!!saved.followed})
  wx.setNavigationBarTitle({title:value.titles[view]})
 },
 select(e){const id=e.currentTarget.dataset.id;if(!this.data.tabs.some(t=>t.id===id))return;if(id.startsWith('value-')){this.requested=id.slice(6);this.refresh()}else wx.navigateTo({url:business.route(id)})},
 authorized(){const now=session.current();return now&&this.context&&now.account.id===this.context.account.id&&now.identity.id===this.context.identity.id&&now.loginId===this.context.loginId&&value.views(now.identity.role).includes(this.data.view)},
 persist(next){if(!this.authorized()){this.setData({error:'账号或身份已改变，请重新进入本页。'});return false}try{session.save('value-loop-v1',next);this.saved=next;this.setData({error:'',notice:'保存在当前账号及身份的本机草稿，未跨端发布、未发通知、未付款或锁库。'});return true}catch{this.setData({error:'本地储存不可用，本次更改未保存。'});return false}},
 edit(e){const field=e.currentTarget.dataset.field;this.setData({[field]:e.detail.value,error:'',notice:''});if(['quantity','gradeProduct'].includes(field))this.setData({matchResult:null})},
 consentChange(e){this.setData({consent:e.detail.value.includes('confirmed'),error:''})},
 publicConsentChange(e){this.setData({publicConsent:e.detail.value.includes('confirmed'),error:''})},
 formEdit(e){const id=e.currentTarget.dataset.id;if(!moneyFields.has(id))return;this.setData({fields:this.data.fields.map(f=>f.id===id?Object.assign({},f,{value:e.detail.value}):f),incomeResult:null,error:''})},
 savePassport(){if(!this.authorized())return this.setData({error:'账号或身份已改变，请重新进入本页。'});if(!['farmer','cooperative'].includes(this.context.identity.role))return this.setData({error:'此身份只能查看公开摘要，不能修改履历'});if(!this.data.publicConsent||this.data.note.trim().length<8)return this.setData({error:'请核对摘要公开范围并补充批次对应说明'});if(this.persist(Object.assign({},this.saved,{passportStatus:'待独立审核（本地）',passportNote:this.data.note.trim()})))this.setData({passportStatus:'待独立审核（本地）',notice:'已保存待独立审核草稿；小程序无自审核入口，也未正式发布。'})},
 generate(){try{this.setData({storyText:value.story(this.context?this.context.identity.role:''),error:''})}catch(e){this.setData({error:e.message})}},
 saveStory(){if(!this.context||!['farmer','cooperative'].includes(this.context.identity.role)||!this.data.consent)return this.setData({error:'需额外整理授权并核对内容与媒体，不能替本人公开'});this.addDraft(this.data.storyText,'待本人确认草稿')},
 addDraft(copy,status){if(!this.authorized())return this.setData({error:'账号或身份已改变，请重新进入本页。'});if(typeof copy!=='string'||copy.trim().length<8||copy.length>2000)return this.setData({error:'请填写8–2000字测试说明，不输入真实私人信息'});if(this.saved.drafts.length>=200)return this.setData({error:'本机草稿已满'});const draft={id:'value-'+Date.now()+'-'+this.saved.drafts.length,view:this.data.view,text:copy.trim(),status,at:new Date().toISOString()},next=Object.assign({},this.saved,{drafts:[draft,...this.saved.drafts]});if(this.persist(next))this.setData({drafts:next.drafts.filter(d=>d.view===this.data.view),description:'',storyText:'',consent:false})},
 calculate(){if(!this.authorized())return this.setData({error:'账号或身份已改变，请重新进入本页。'});const input=Object.fromEntries(this.data.fields.map(f=>[f.id,f.value]));try{const incomeResult=value.estimate(input);if(this.persist(Object.assign({},this.saved,{income:input})))this.setData({incomeResult})}catch(e){this.setData({error:e.message,incomeResult:null})}},
 gradeChange(e){const index=Number(e.detail.value);if(this.data.gradeOptions[index])this.setData({gradeIndex:index,matchResult:null})},
 unitChange(e){const index=Number(e.detail.value);if(this.data.unitOptions[index])this.setData({unitIndex:index,matchResult:null})},
 match(){try{this.setData({matchResult:value.match(this.data.gradeProduct,this.data.gradeOptions[this.data.gradeIndex],this.data.quantity,this.data.unitOptions[this.data.unitIndex]),error:''})}catch(e){this.setData({error:e.message,matchResult:null})}},
 saveDemand(){if(!this.context||!['buyer','processor','cooperative'].includes(this.context.identity.role)||!this.data.matchResult)return this.setData({error:'先匹配货源；当前身份须有补货需求入口'});if(this.data.description.trim().length<8)return this.setData({error:'请补充至少8字的用途、时效与质量要求'});this.addDraft(this.data.gradeProduct+' / '+this.data.gradeOptions[this.data.gradeIndex]+' / '+this.data.matchResult.kg+'kg；'+this.data.description,'本地分级需求 · 未锁库')},
 follow(){if(!session.requireSession('workspace'))return;if(this.persist(Object.assign({},this.saved,{followed:!this.data.followed})))this.setData({followed:!this.data.followed})},
 saveNote(){this.addDraft(this.data.description,'本地'+(this.data.view==='feedback'?'反馈':this.data.view==='calendar'?'询价':'跟进')+' · 未发送')},
 help(){wx.navigateTo({url:'/pages/help/help'})},back(){wx.switchTab({url:'/pages/workspace/workspace'})}
})
