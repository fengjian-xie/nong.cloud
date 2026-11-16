const session = require('../../utils/session'), catalog = require('../../utils/catalog'), business=require('../../utils/business-groups')
Page({
 data: { context: null, groups: [], cards: false },
 onShow() { if(require('../../utils/connection').enabled())return wx.redirectTo({url:'/pages/connected/connected'}); this.refresh() },
 refresh() {
  const context = session.current()
  if (!context) { this.setData({ context: null, groups: [], cards: false }); return }
  const role = context.identity.role, groups=business.groups(catalog.modules(role))
  this.setData({ context, groups, cards: catalog.hasCards(role), headline: role === 'farmer' ? '安心种好地，记录有人帮。' : '协同好每一项农事。' })
 },
 login() { wx.navigateTo({ url: '/pages/login/login?tab=workspace' }) }, switchChanged() { this.refresh() },
 openModule(e) { const id=e.currentTarget.dataset.id, context=session.current(); if(!context||!catalog.moduleById(context.identity.role,id))return this.refresh(); wx.navigateTo({ url:business.route(id) }) },
 openCards() { wx.navigateTo({ url: '/pages/cards/cards' }) }, goFarm() { wx.switchTab({ url: '/pages/farm/farm' }) }, help() { wx.navigateTo({ url: '/pages/help/help' }) }
})
