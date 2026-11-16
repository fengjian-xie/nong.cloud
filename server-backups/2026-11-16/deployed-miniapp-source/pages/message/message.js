const session=require('../../utils/session'), seed=require('../../utils/message-ui'), catalog=require('../../utils/catalog')
Page({
 data:{context:null,messages:[],filtered:[],categories:['全部','未读','农事','服务','农场','系统'],category:'全部',selected:null,unread:0},
 onShow(){if(require('../../utils/connection').enabled())return wx.redirectTo({url:'/pages/connected/connected?module=messages'});this.refresh()},
 refresh(){const context=session.current();const messages=context?seed.messages(context.identity.role).map(m=>Object.assign({},m,{read:session.read('message:'+m.id,false),org:context.identity.org,role:context.identity.label})):[];this.setData({context,messages,unread:messages.filter(m=>!m.read).length,selected:null});this.applyFilter()},
 applyFilter(){this.setData({filtered:this.data.messages.filter(m=>this.data.category==='全部'||(this.data.category==='未读'?!m.read:m.category===this.data.category))})},
 category(e){this.setData({category:e.currentTarget.dataset.id,selected:null});this.applyFilter()},
 open(e){const selected=this.data.messages.find(m=>m.id===e.currentTarget.dataset.id);if(!selected||!session.current())return;session.save('message:'+selected.id,true);this.setData({messages:this.data.messages.map(m=>m.id===selected.id?Object.assign({},m,{read:true}):m),selected:Object.assign({},selected,{read:true}),unread:this.data.messages.filter(m=>!m.read&&m.id!==selected.id).length});this.applyFilter()},
 back(){this.setData({selected:null})},
 readAll(){if(!session.current())return;this.data.messages.forEach(m=>session.save('message:'+m.id,true));this.refresh()},
 related(){const target=this.data.selected&&this.data.selected.target,c=session.current();if(!target||!c)return;if(target.type==='farm')return wx.switchTab({url:'/pages/farm/farm'});if(target.type==='cards'&&catalog.hasCards(c.identity.role))return wx.navigateTo({url:'/pages/cards/cards'});if(target.type==='module'&&catalog.moduleById(c.identity.role,target.id))wx.navigateTo({url:'/pages/module/module?id='+target.id})},
 login(){wx.navigateTo({url:'/pages/login/login?tab=message'})}
})
