const session = require('../../utils/session'), catalog = require('../../utils/catalog'), ui = require('../../utils/module-ui'), address = require('../../utils/address'), business=require('../../utils/business-groups')
const applicationRoles = Object.keys(catalog.roleNames).filter(role => role !== 'consumer').map(id=>({id,name:catalog.roleNames[id]}))
Page({
 data: { context: null, definition: null, fields: [], sample: [], steps: [], view: 'overview', draftCount: 0, error: '', notice: '', filter: 'all', detail: false, laborDays: '', dailyPrice: '', materials: '', other: '', yieldKg: '', markup: '35', costResult: null, applicationRoles, applicationRoleNames:applicationRoles.map(r=>r.name), applicationRoleIndex:-1, region:['福建省','宁德市','福安市'], regionChosen:false, towns:address.townships(['福建省','宁德市','福安市']), townIndex:-1, detailAddress:'' },
 onLoad(query) { this.moduleId = query.id; this.load() },
 onShow() { if (this.moduleId) this.load() },
 load() {
  if(require('../../utils/connection').enabled())return wx.redirectTo({url:'/pages/connected/connected?module='+encodeURIComponent({application:'applications',plots:'plots',records:'records',services:'requests',membership:'memberships',stock:'stock'}[this.moduleId]||this.moduleId||'unavailable')})
  const context = session.current(), id = this.moduleId
  const definition = catalog.moduleById(context ? context.identity.role : '', id)
  if (!definition || (!context && id !== 'application')) { this.setData({ context, definition: null, error: '此身份不可查看该业务，请回工作台选择已绑定身份。' }); return }
  const spec = ui.get(id)
  const saved = context ? session.read('draft:' + id, []) : []
  this.setData({variants:context?business.related(catalog.modules(context.identity.role),id):[]})
  this.setData({ context, definition, fields: spec.fields.map(label => ({ label, value: '' })), sample: spec.sample.map(([label,value]) => ({ label,value })), steps: spec.steps, draftCount: saved.length, drafts: saved, error: '', notice: '', view: 'overview', detail: false, costResult: null })
  wx.setNavigationBarTitle({ title: definition.title })
 },
 authorized() { const now = session.current(); return now && this.data.context && now.account.id === this.data.context.account.id && now.identity.id === this.data.context.identity.id && now.loginId === this.data.context.loginId && !!catalog.moduleById(now.identity.role,this.moduleId) },
 variant(e) { if(!this.authorized())return this.setData({error:'身份已改变，请重新进入工作台。'}); const id=e.currentTarget.dataset.id; if(this.data.variants.some(v=>v.id===id))wx.navigateTo({url:business.route(id)}) },
 form() { if (!this.data.context) { wx.navigateTo({ url: '/pages/login/login?tab=workspace' }); return } this.setData({ view: 'form', error: '', notice: '' }) },
 roleChange(e) { const index=Number(e.detail.value); if(Number.isInteger(index)&&applicationRoles[index])this.setData({applicationRoleIndex:index,error:''}) },
 regionChange(e) { const region=e.detail.value; if(!Array.isArray(region)||region.length!==3||region.some(x=>!x))return; this.setData({region,regionChosen:true,towns:address.townships(region),townIndex:-1,error:''}) },
 townChange(e) { const index=Number(e.detail.value); if(Number.isInteger(index)&&this.data.towns[index])this.setData({townIndex:index,error:''}) },
 detailAddressChange(e) { this.setData({detailAddress:e.detail.value,error:''}) },
 overview() { this.setData({ view: 'overview', error: '' }) },
 edit(e) { const fields = this.data.fields.map((f,i) => i === Number(e.currentTarget.dataset.index) ? Object.assign({},f,{ value:e.detail.value }) : f); this.setData({ fields, notice: '', error: '' }) },
 save() {
  if (!this.authorized()) return this.setData({ error: '身份已改变，请重新进入本页。' })
  if (this.data.fields.some(f => !f.value.trim())) return this.setData({ error: '请填写所有草稿字段。请勿输入真实隐私或支付信息。' })
  const values = this.data.fields.map(f => ({ label:f.label,value:f.value.trim() }))
  let application=null
  if(this.moduleId==='application') {
   const role=applicationRoles[this.data.applicationRoleIndex], town=this.data.towns[this.data.townIndex]
   if(!role||!this.data.regionChosen||!address.validTown(this.data.region,town)||!this.data.detailAddress.trim())return this.setData({error:'请选择申请角色、省市区县和乡镇/街道，并填写详细地址。'})
   application={role:role.id,region:this.data.region.slice(),town,detailAddress:this.data.detailAddress.trim(),state:'本地草稿 · 未提交'}
   values.unshift({label:'申请角色',value:role.name},{label:'所在地址',value:this.data.region.join(' / ')+' / '+town+' / '+application.detailAddress})
  }
  const drafts = session.read('draft:' + this.moduleId, [])
  drafts.push({ id: 'local-' + Date.now() + '-' + drafts.length, values, application, status: '本地草稿 · 未提交', org: this.data.context.identity.org })
  session.save('draft:' + this.moduleId,drafts)
  this.setData({ drafts, draftCount:drafts.length, view:'overview', notice:'草稿已保存在当前账号及身份下，未提交真实业务；申请角色不会自动开通权限。', fields:this.data.fields.map(f=>Object.assign({},f,{value:''})), applicationRoleIndex:-1,regionChosen:false,townIndex:-1,detailAddress:'' })
 },
 filter(e) { this.setData({ filter: e.currentTarget.dataset.id }) }, toggleDetail() { this.setData({ detail: !this.data.detail }) },
 advance() { if (!this.authorized() || !['machine','team','protection'].includes(this.data.context.identity.role)) return; const step = Math.min((session.read('service-step',0) + 1),3); session.save('service-step',step); this.setData({ notice:'演示状态：' + this.data.steps[step] + '。不能自验收，不形成真实服务。' }) },
 costEdit(e) { this.setData({ [e.currentTarget.dataset.field]:e.detail.value, costResult:null, error:'' }) },
 calculate() {
  if (!this.authorized()) return
  const values = ['laborDays','dailyPrice','materials','other','yieldKg','markup'].map(k => this.data[k].trim())
  if (values.some(v => !/^\d+(\.\d{1,2})?$/.test(v))) return this.setData({ error:'请填写非负数字，最多两位小数；不要用按键次数推算出工。' })
  const [days,price,materials,other,yieldKg,markup] = values.map(Number)
  if (!yieldKg || markup > 100 || values.some(v=>Number(v)>100000000)) return this.setData({ error:'请检查产量、出工人天及参考加价比例（0–100%）。' })
  const cash = materials + other, complete = cash + days * price
  if (!Number.isSafeInteger(Math.round(complete * 100)) || !Number.isSafeInteger(Math.round(complete/yieldKg*(1+markup/100)*100))) return this.setData({error:'计算超出安全金额范围，请缩小统计范围。'})
  this.setData({ error:'', costResult:{ cash:cash.toFixed(2), complete:complete.toFixed(2), unit:(complete/yieldKg).toFixed(2), reference:(complete/yieldKg*(1+markup/100)).toFixed(2) } })
 },
 back() { wx.switchTab({ url:'/pages/workspace/workspace' }) }
})
