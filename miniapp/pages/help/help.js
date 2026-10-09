const session=require('../../utils/session'), support=require('../../utils/support')
Page({
 data:{context:null,faqs:support.faqs,selectedFaq:null,categories:support.categories,methods:support.methods,categoryIndex:0,methodIndex:0,description:'',tickets:[],selectedTicket:null,tab:'guide',error:'',notice:''},
 onShow(){if(require('../../utils/connection').enabled())return wx.redirectTo({url:'/pages/connected/connected?module=tickets'});this.refresh()},
 refresh(){const context=session.current(),old=this.data.context,changed=!old||!context||old.account.id!==context.account.id||old.identity.id!==context.identity.id;this.setData(Object.assign({context,tickets:support.visibleTickets(context,context?session.read('help-tickets',[]):[]),selectedTicket:null,error:'',notice:''},changed?{description:'',categoryIndex:0,methodIndex:0,tab:'guide',selectedFaq:null}:{}))},
 tab(e){this.setData({tab:e.currentTarget.dataset.id,selectedTicket:null,error:'',notice:''})},
 faq(e){this.setData({selectedFaq:this.data.selectedFaq===e.currentTarget.dataset.id?null:e.currentTarget.dataset.id})},
 category(e){this.setData({categoryIndex:Number(e.detail.value),error:''})},
 method(e){this.setData({methodIndex:Number(e.detail.value),error:''})},
 edit(e){this.setData({description:e.detail.value,error:'',notice:''})},
 login(){wx.navigateTo({url:'/pages/login/login?tab=me'})},
 hotline(){wx.showModal({title:'人工帮助与回访',content:'真实热线、服务时间和坐席待中心配置。当前不拨号、不录音、不预约实际回访；可先保存本地问题或回访意向。',showCancel:false})},
 save(){
  const now=session.current(),loaded=this.data.context
  if(!now){this.login();return}
  if(!loaded||now.account.id!==loaded.account.id||now.identity.id!==loaded.identity.id)return this.setData({error:'身份已改变，请重新进入帮助中心。'})
  try{const tickets=support.visibleTickets(now,session.read('help-tickets',[]));if(tickets.length>=100)throw new Error('本地演示问题已达100条，请勿重复登记。');const ticket=support.createTicket(now,this.data.description,this.data.categoryIndex,this.data.methodIndex,tickets.length);session.save('help-tickets',[ticket,...tickets]);this.setData({tickets:[ticket,...tickets],description:'',tab:'tickets',selectedTicket:ticket,notice:'问题已保存在本机，尚未提交中心；电话回访只是意向，未拨号或预约。',error:''})}catch(error){this.setData({error:error.message||'保存失败，请重试。'})}
 },
 open(e){const now=session.current();if(!now||!this.data.context||now.identity.id!==this.data.context.identity.id)return this.setData({error:'身份已改变，请重新进入帮助中心。'});const selectedTicket=this.data.tickets.find(t=>t.id===e.currentTarget.dataset.id&&t.ownerAccount===now.account.id&&t.ownerIdentity===now.identity.id);if(selectedTicket)this.setData({selectedTicket})},
 back(){this.setData({selectedTicket:null})}
})
