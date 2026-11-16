const session=require('../../utils/session'), seed=require('../../utils/farm-data')
Page({
 data:{farms:seed.farms,filtered:seed.farms,selected:null,query:'',followed:false,intent:false,tab:'overview',timeline:seed.timeline,tracking:seed.tracking,afterSale:'',savedAfterSale:'',error:''},
 onShow(){if(require('../../utils/connection').enabled())return wx.redirectTo({url:'/pages/connected/connected?module=cloudFarm'});if(this.data.selected)this.loadSaved()},
 search(e){const query=e.detail.value;this.setData({query,filtered:seed.farms.filter(f=>(f.title+f.region).includes(query))})},
 open(e){const selected=seed.farms.find(f=>f.id===e.currentTarget.dataset.id);if(!selected)return;this.setData({selected,tab:'overview',afterSale:'',savedAfterSale:'',error:''});this.loadSaved()},
 back(){this.setData({selected:null,error:''})},
 changeTab(e){this.setData({tab:e.currentTarget.dataset.id,error:''})},
 contract(){this.setData({tab:'contract'})},
 productPassport(){wx.navigateTo({url:'/pages/value/value?view=passport'})},
 loadSaved(){const ctx=session.current(),id=this.data.selected.id;this.setData({followed:ctx?session.read('farm-follow:'+id,false):false,intent:ctx?session.read('farm-intent:'+id,false):false,savedAfterSale:ctx?session.read('farm-aftersale:'+id,''):''})},
 follow(){if(!session.requireSession('farm'))return;session.save('farm-follow:'+this.data.selected.id,!this.data.followed);this.loadSaved()},
 intention(){const before=session.requireSession('farm'),farmId=this.data.selected&&this.data.selected.id;if(!before||!farmId)return;wx.showModal({title:'保存演示意向',content:'仅保存本地兴趣状态，不发送给农场、不形成合同、不收款。实际方案、价格与合同待经营主体确认。',success:r=>{if(r.confirm){const current=session.current();if(!current||current.account.id!==before.account.id||current.identity.id!==before.identity.id||!this.data.selected||this.data.selected.id!==farmId)return this.setData({error:'身份或农场已改变，请重新确认意向。'});session.save('farm-intent:'+farmId,true);this.loadSaved();this.setData({tab:'tracking'})}}})},
 afterSaleEdit(e){this.setData({afterSale:e.detail.value,error:''})},
 saveAfterSale(){if(!session.requireSession('farm'))return;if(!this.data.afterSale.trim())return this.setData({error:'请填写演示问题说明，不输入真实隐私。'});session.save('farm-aftersale:'+this.data.selected.id,this.data.afterSale.trim());this.loadSaved();this.setData({afterSale:''})}
})
