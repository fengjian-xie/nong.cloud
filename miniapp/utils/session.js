const catalog = require('./catalog')
const connection = require('./connection')
const KEY = 'xiangqiao-demo-session-v1', PREFIX = 'xiangqiao-demo:'
function current() {
 if (connection.enabled()) return connection.context()
 const raw = wx.getStorageSync(KEY)
 const account = raw && catalog.accounts.find(a => a.id === raw.accountId)
 const identity = account && account.identities.find(i => i.id === raw.identityId)
 if (!account || !identity || raw.mode !== 'demo') { if (raw) wx.removeStorageSync(KEY); return null }
 return { account, identity, mode: 'demo', loginId: raw.loginId }
}
function login(accountId) {
 const account = catalog.accounts.find(a => a.id === accountId)
 if (!account) throw new Error('演示账号不存在')
 // Switching accounts replaces only the session, not another account's drafts.
 wx.setStorageSync(KEY, { accountId, identityId: account.identities[0].id, mode: 'demo', loginId: 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2) })
 return current()
}
function switchIdentity(identityId) {
 if (connection.enabled()) return connection.switchIdentity(identityId)
 const ctx = current()
 if (!ctx || !ctx.account.identities.some(i => i.id === identityId)) throw new Error('此账号未绑定该身份')
 wx.setStorageSync(KEY, Object.assign({}, wx.getStorageSync(KEY), { identityId }))
 return current()
}
function scopedKey(kind) { const ctx = current(); if (!ctx) throw new Error('请先进入演示账号'); return PREFIX + ctx.account.id + ':' + ctx.identity.id + ':' + kind }
function read(kind, fallback) { if (connection.enabled()) throw new Error('数据库模式不能读取演示草稿'); const value = wx.getStorageSync(scopedKey(kind)); return value === '' || value === undefined || value === null ? fallback : value }
function save(kind, value) { if (connection.enabled()) throw new Error('数据库模式不能将演示草稿当作真实记录'); wx.setStorageSync(scopedKey(kind), value) }
function logout() {
 if (connection.enabled()) return connection.logout()
 const ctx=current()
 wx.removeStorageSync(KEY)
 if(ctx)wx.getStorageInfoSync().keys.filter(key => key.indexOf(PREFIX+ctx.account.id+':') === 0).forEach(key => wx.removeStorageSync(key))
}
function requireSession(returnTab) { const ctx = current(); if (!ctx) wx.navigateTo({ url: '/pages/login/login?tab=' + encodeURIComponent(returnTab || 'workspace') }); return ctx }
module.exports = { current, login, switchIdentity, logout, read, save, requireSession, KEY }
