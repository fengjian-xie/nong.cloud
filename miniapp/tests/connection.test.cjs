const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict')
const storage=new Map(),calls=[];let response
global.wx={getStorageSync:k=>storage.get(k)||'',setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),request:opts=>{calls.push(opts);queueMicrotask(()=>response instanceof Error?opts.fail(response):opts.success(response))}}
const api=require('../utils/connection'),session=require('../utils/session')
const me={user:{id:'u',name:'测试'},identities:[{id:'i1',role:'farmer',label:'种植户',org:'测试主体',centerId:'c',subjectId:'s'},{id:'i2',role:'team',label:'农服队',org:'测试农服主体',centerId:'c',subjectId:'t'}],activeIdentityId:'i1',permissions:['plots.read']}
beforeEach(()=>{storage.clear();calls.length=0;response={statusCode:200,data:{code:0,data:{...me,token:'test-token'}}}})
test('backend mode stores independent server session, sends bearer, never grants mock identity',async()=>{api.useBackend();await api.login('test','test-password');assert.equal(session.current().mode,'backend');assert.equal(session.current().account.identities.length,2);response={statusCode:200,data:{code:0,data:{...me,activeIdentityId:'i2',permissions:['services.claim']}}};await session.switchIdentity('i2');assert.equal(calls.at(-1).header.Authorization,'Bearer test-token');assert.equal(session.current().identity.role,'team');assert.deepEqual(session.current().permissions,['services.claim']);assert.throws(()=>session.save('draft',[]),/演示草稿/);assert.throws(()=>session.read('draft',[]),/演示草稿/)})
test('network failure and HTTP denial never save a successful login',async()=>{api.useBackend();response=new Error('offline');await assert.rejects(api.login('test','test-password'),/未确认保存/);assert.equal(api.context(),null);response={statusCode:403,data:{code:403,message:'无此身份',traceId:'trace'}};await assert.rejects(api.login('test','test-password'),/无此身份/);assert.equal(api.context(),null)})
test('401 clears server session; writes carry idempotency and version',async()=>{api.useBackend();await api.login('test','test-password');response={statusCode:200,data:{code:0,data:{id:'p'}}};await api.request('/plots/p',{method:'PATCH',body:{crop:'葡萄'},key:'test-unique-key',version:3});assert.equal(calls.at(-1).header['Idempotency-Key'],'test-unique-key');assert.equal(calls.at(-1).header['If-Match'],'3');response={statusCode:401,data:{code:401,message:'过期'}};await assert.rejects(api.refresh(),/过期/);assert.equal(api.context(),null)})
test('test password entry cannot target a non-local host',async()=>{const previous=api.config.apiBase;api.config.apiBase='https://api.nong.cloud/api/v1';try{await assert.rejects(api.login('test','test-password'),/禁止测试密码/);assert.equal(calls.length,0)}finally{api.config.apiBase=previous}})
test('logout revokes backend session before clearing local metadata',async()=>{api.useBackend();await api.login('test','test-password');response={statusCode:200,data:{code:0,data:{loggedOut:true}}};await session.logout();assert.match(calls.at(-1).url,/auth\/logout$/);assert.equal(api.context(),null)})
test('business requests pin the expected identity; malformed success is rejected',async()=>{api.useBackend();await api.login('test','test-password');response={statusCode:200,data:{code:0,data:{id:'p'}}};await api.request('/plots',{identity:'i1'});assert.equal(calls.at(-1).header['X-XQ-Identity'],'i1');response={statusCode:200,data:{code:0}};await assert.rejects(api.request('/plots'),/格式不一致/)})
test('pagination has one bounded shape and explicit page controls',()=>{const page={items:[{id:'p'}],total:3,page:1,size:2,hasNext:true};assert.deepEqual(api.pageRows(page),page.items);assert.throws(()=>api.pageRows({...page,hasNext:undefined}),/分页契约/);assert.equal(api.listPath('/plots?size=100',2),'/plots?page=2&size=20')})
test('a delayed profile refresh cannot restore an old identity after a switch',async()=>{
 api.useBackend();await api.login('test','test-password');const request=wx.request;let delayed
 try{wx.request=opts=>{if(opts.url.endsWith('/users/me'))delayed=opts;else opts.success({statusCode:200,data:{code:0,data:{...me,activeIdentityId:'i2',permissions:['services.claim']}}})};const refreshing=api.refresh();await api.switchIdentity('i2');delayed.success({statusCode:200,data:{code:0,data:me}});await refreshing;assert.equal(api.context().identity.id,'i2')}finally{wx.request=request}
})
test('a delayed profile cannot resurrect a logged-out session',async()=>{
 api.useBackend();await api.login('test','test-password');const request=wx.request;let delayed
 try{wx.request=opts=>{if(opts.url.endsWith('/users/me'))delayed=opts;else opts.success({statusCode:200,data:{code:0,data:{loggedOut:true}}})};const refreshing=api.refresh();await api.logout();delayed.success({statusCode:200,data:{code:0,data:me}});await refreshing;assert.equal(api.context(),null)}finally{wx.request=request}
})
test('a delayed password login cannot resurrect a session after logout',async()=>{
 api.useBackend();const request=wx.request;let delayed
 try{wx.request=opts=>{delayed=opts};const loggingIn=api.login('test','test-password');const rejected=assert.rejects(loggingIn,/会话已变化/);await api.logout();delayed.success({statusCode:200,data:{code:0,data:{...me,token:'late-token'}}});await rejected;assert.equal(api.context(),null)}finally{wx.request=request}
})
test('a delayed password login cannot replace demo mode with a server session',async()=>{
 api.useBackend();const request=wx.request;let delayed
 try{wx.request=opts=>{delayed=opts};const loggingIn=api.login('test','test-password');const rejected=assert.rejects(loggingIn,/会话已变化/);api.useDemo();delayed.success({statusCode:200,data:{code:0,data:{...me,token:'late-token'}}});await rejected;assert.equal(api.context(),null);assert.equal(api.enabled(),false)}finally{wx.request=request}
})
test('the most recent login wins even when the previous login responds last',async()=>{
 api.useBackend();const request=wx.request,delayed=[]
 try{wx.request=opts=>delayed.push(opts);const first=api.login('first','test-password');const rejected=assert.rejects(first,/会话已变化/);const second=api.login('second','test-password');delayed[1].success({statusCode:200,data:{code:0,data:{...me,token:'new-token'}}});await second;delayed[0].success({statusCode:200,data:{code:0,data:{...me,token:'old-token'}}});await rejected;assert.equal(storage.get('xiangqiao-server-session-v1').token,'new-token')}finally{wx.request=request}
})
test('a delayed logout cannot clear a newer successful login',async()=>{
 api.useBackend();await api.login('old','test-password');const request=wx.request;let delayedLogout
 try{wx.request=opts=>{if(opts.url.endsWith('/auth/logout'))delayedLogout=opts;else opts.success({statusCode:200,data:{code:0,data:{...me,token:'new-token'}}})};const loggingOut=api.logout();await api.login('new','test-password');delayedLogout.success({statusCode:200,data:{code:0,data:{loggedOut:true}}});await loggingOut;assert.equal(storage.get('xiangqiao-server-session-v1').token,'new-token')}finally{wx.request=request}
})
test('switching to demo while WeChat obtains a code prevents the subsequent server login',async()=>{
 api.useBackend();const login=wx.login;let callback
 try{wx.login=opts=>{callback=opts};const loggingIn=api.wechatLogin();const rejected=assert.rejects(loggingIn,/会话已变化/);api.useDemo();callback.success({code:'synthetic-test-code'});await rejected;assert.equal(calls.length,0);assert.equal(api.context(),null)}finally{wx.login=login}
})
