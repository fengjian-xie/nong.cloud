const catalog = require('../../utils/catalog'), session = require('../../utils/session')
const connection = require('../../utils/connection')
Page({
 data: { accounts: catalog.accounts.map(a => ({ id: a.id, name: a.name, roles: a.identities.map(i => i.label).join(' / ') })), selected: 'farmer-team', acknowledged: false, tab: 'workspace', backend: false, username: '', password: '', busy: false, error: '' },
 onLoad(query) { this.setData({ backend: connection.enabled(), tab: ['workspace','me','message','farm'].includes(query.tab) ? query.tab : 'workspace' }) },
 backendMode() { connection.useBackend(); this.setData({ backend: true, error: '' }) },
 async demoMode() { try { await connection.logout(); connection.useDemo(); this.setData({ backend: false, error: '' }) } catch (e) { this.setData({ error: e.message }) } },
 credential(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },
 async serverLogin() { if (this.data.busy) return; this.setData({ busy: true, error: '' }); try { await connection.login(this.data.username, this.data.password); this.setData({ password: '' }); wx.navigateTo({ url: '/pages/connected/connected' }) } catch (e) { this.setData({ error: e.message }) } finally { this.setData({ busy: false }) } },
 async wechatLogin() { this.setData({ busy: true, error: '' }); try { await connection.wechatLogin(); wx.navigateTo({ url: '/pages/connected/connected' }) } catch (e) { this.setData({ error: e.message }) } finally { this.setData({ busy: false }) } },
 choose(e) { this.setData({ selected: e.currentTarget.dataset.id }) },
 acknowledge(e) { this.setData({ acknowledged: e.detail.value.length > 0 }) },
 enter() {
  if (!this.data.acknowledged) return wx.showToast({ title: '请先确认演示说明', icon: 'none' })
  session.login(this.data.selected)
  wx.switchTab({ url: '/pages/' + this.data.tab + '/' + this.data.tab })
 }
})
