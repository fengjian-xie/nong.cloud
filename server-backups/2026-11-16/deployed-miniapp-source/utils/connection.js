// Local development configuration. Production requires an HTTPS legal domain.
const config = { apiBase: 'http://127.0.0.1:8080/api/v1', allowLocalPassword: true }
const MODE = 'xiangqiao-data-mode-v1', SESSION = 'xiangqiao-server-session-v1'
let generation = 0
function enabled() { return wx.getStorageSync(MODE) === 'backend' }
function useBackend() { generation++; wx.setStorageSync(MODE, 'backend') }
function useDemo() { generation++; wx.removeStorageSync(MODE); wx.removeStorageSync(SESSION) }
function key() { return 'mini-' + Date.now() + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) }
function current() { const value = wx.getStorageSync(SESSION); return value && value.version === 1 && value.me && value.token ? value : null }
function context() {
 const value = current(); if (!value) return null
 const me = value.me, identity = me.identities.find(i => i.id === me.activeIdentityId)
 if (!identity) return null
 return { account: { id: me.user.id, name: me.user.name, identities: me.identities }, identity, mode: 'backend', permissions: me.permissions }
}
function request(path, options) {
 const opts = options || {}, session = current(), header = { 'Content-Type': 'application/json' }
 if (session) header.Authorization = 'Bearer ' + session.token
 if (session && !/^\/(users\/me|auth\/|identities\/)/.test(path)) header['X-XQ-Identity'] = opts.identity || session.me.activeIdentityId
 if (opts.key) header['Idempotency-Key'] = opts.key
 if (opts.version !== undefined) header['If-Match'] = String(opts.version)
 return new Promise((resolve, reject) => wx.request({
  url: config.apiBase + path, method: opts.method || 'GET', data: opts.body, header, timeout: 15000,
  success(result) { const envelope = result.data; if (result.statusCode >= 200 && result.statusCode < 300 && envelope && envelope.code === 0 && Object.prototype.hasOwnProperty.call(envelope,'data')) resolve(envelope.data); else { const error = new Error(envelope && envelope.message || '接口数据格式不一致或请求失败'); error.status = result.statusCode; error.traceId = envelope && envelope.traceId; error.errorCode = envelope && envelope.errorCode; if (result.statusCode === 401 && session && current() && current().token === session.token) {generation++;wx.removeStorageSync(SESSION)} reject(error) } },
  fail() { reject(new Error('网络或后端不可用，数据未确认保存，请重试')) }
 }))
}
function saveLogin(data, revision) { if(revision!==generation||!enabled())throw new Error('会话已变化，请重新登录');if(!data || typeof data.token!=='string' || !Array.isArray(data.identities) || !Array.isArray(data.permissions) || !data.user || !data.identities.some(i=>i.id===data.activeIdentityId))throw new Error('登录数据与身份契约不一致');generation++;wx.setStorageSync(SESSION, { version: 1, token: data.token, me: { user: data.user, identities: data.identities, activeIdentityId: data.activeIdentityId, permissions: data.permissions } }); return context() }
async function login(username, password) {
 if (!config.allowLocalPassword || !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/api\/v1$/.test(config.apiBase)) throw new Error('非本机环境禁止测试密码入口')
 const revision=++generation
 return saveLogin(await request('/auth/password/login', { method: 'POST', body: { username, password } }),revision)
}
async function wechatLogin() { const revision=++generation;const code = await new Promise((resolve, reject) => wx.login({ success: result => result.code ? resolve(result.code) : reject(new Error('微信未返回code')), fail: () => reject(new Error('微信登录不可用')) }));if(revision!==generation||!enabled())throw new Error('会话已变化，请重新登录');return saveLogin(await request('/auth/wechat/login', { method: 'POST', body: { code } }),revision) }
async function refresh() { const value = current(), revision=generation; if (!value) return null; const me = await request('/users/me'); if(revision!==generation||!current()||current().token!==value.token)return context(); wx.setStorageSync(SESSION, Object.assign({}, value, { me })); return context() }
async function switchIdentity(id) { const value = current(), revision=++generation; if (!value) throw new Error('请先登录'); const me = await request('/identities/' + encodeURIComponent(id) + '/switch', { method: 'POST', body: {} });if(revision!==generation||!current()||current().token!==value.token)throw new Error('会话已变化，请重新加载身份');wx.setStorageSync(SESSION, Object.assign({}, value, { me })); return context() }
async function logout() {const revision=++generation;if (current()) {try{await request('/auth/logout', { method: 'POST', body: {} })}catch(e){if(e.status!==401)throw e}}if(revision===generation)wx.removeStorageSync(SESSION) }
function pageRows(result) {if(Array.isArray(result))return result;if(!result||!Array.isArray(result.items)||!Number.isInteger(result.total)||result.total<0||!Number.isInteger(result.page)||result.page<1||!Number.isInteger(result.size)||result.size<1||result.size>100||typeof result.hasNext!=='boolean'||result.items.length>result.size)throw new Error('列表字段与分页契约不一致');return result.items}
function listPath(path,page,size) {return path.split('?')[0]+'?page='+page+'&size='+(size||20)}
module.exports = { config, enabled, useBackend, useDemo, context, request, login, wechatLogin, refresh, switchIdentity, logout, key, pageRows, listPath }
