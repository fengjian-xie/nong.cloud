// Lightweight preview renderer for this project's WXML subset, not a WeChat emulator.
// Uses the SAME native Page JS, fields, WXML, WXSS and local demo store.
(async function () {
 if(location.protocol==='file:') {
  const target=document.getElementById('screen'),notice=document.createElement('p'),link=document.createElement('a');
  notice.className='stage-error';notice.textContent='文件预览无法连接数据库。请启动本地预览服务，并通过 HTTP 地址进行接口联调。';
  link.href='http://127.0.0.1:4201/';link.textContent='打开本地数据库联调预览';target.replaceChildren(notice,link);return;
 }
 const previewRoot = new URL('../', document.currentScript.src)
 const assetUrl = value => new URL(String(value).replace(/^\/+/, ''), previewRoot).href
 const bundle = await (await fetch(new URL('source-bundle.json', previewRoot))).json(), files = bundle.files, config = bundle.config
 const moduleCache = {}, screen = document.getElementById('screen'), componentInstances = new Map()
 const roleChooser = window.XqChoiceMenu(document.getElementById('role-preview-menu'))
 let page = null, route = '', history = [], rendering = false, renderQueued = false, sequence = 0
 const clone = value => JSON.parse(JSON.stringify(value))
 function resolve(base, relative) {
  const parts = (relative.startsWith('.') ? base.split('/').slice(0,-1).join('/') + '/' + relative : relative).split('/'), out=[]
  parts.forEach(p=>{if(p==='..')out.pop();else if(p!=='.'&&p)out.push(p)})
  return out.join('/') + (out.join('/').endsWith('.js')?'':'.js')
 }
 function requireModule(id) {
  if(moduleCache[id]) return moduleCache[id].exports
  if(!files[id]) throw new Error('Preview module missing: '+id)
  const module={exports:{}};moduleCache[id]=module
  new Function('require','module','exports','wx',files[id])(name=>requireModule(resolve(id,name)),module,module.exports,window.wx)
  return module.exports
 }
 function scheduleRender() { if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;render()}) }
 function instance(spec, data) {
  const inst={data:clone(data||spec.data||{}),setData(next){Object.assign(this.data,next);scheduleRender()}}
  for(const[key,value]of Object.entries(spec))if(typeof value==='function')inst[key]=value.bind(inst)
  for(const[key,value]of Object.entries(spec.methods||{}))inst[key]=value.bind(inst)
  return inst
 }
 function modal(options) {
  const layer=document.getElementById('dialog-layer'), dialog=document.createElement('div');dialog.className='dialog'
  const title=document.createElement('h3');title.textContent=options.title;dialog.append(title)
  const content=document.createElement('p');content.textContent=options.content;dialog.append(content)
  const actions=document.createElement('div');actions.className='dialog-actions'
  const close=confirm=>{layer.replaceChildren();if(options.success)options.success({confirm,cancel:!confirm})}
  if(options.showCancel!==false){const cancel=document.createElement('button');cancel.className='cancel';cancel.textContent='取消';cancel.onclick=()=>close(false);actions.append(cancel)}
  const ok=document.createElement('button');ok.textContent='确定';ok.onclick=()=>close(true);actions.append(ok);dialog.append(actions);layer.replaceChildren(dialog)
 }
 window.wx={
  request(options){const requested=new URL(options.url);if(requested.origin!=='http://127.0.0.1:8080'||!requested.pathname.startsWith('/api/v1/')){options.fail&&options.fail({errMsg:'预览只允许固定本地接口'});return}const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.timeout||15000);fetch(requested.pathname+requested.search,{method:options.method||'GET',headers:options.header,body:options.method&&options.method!=='GET'?JSON.stringify(options.data):undefined,signal:controller.signal,credentials:'omit'}).then(async result=>{options.success&&options.success({statusCode:result.status,data:await result.json()})}).catch(()=>options.fail&&options.fail({errMsg:'本地接口不可用'})).finally(()=>clearTimeout(timer))},
  login(options){options.fail&&options.fail({errMsg:'网页预览不能产生真实微信code，请在微信开发者工具中测试'})},
  getStorageSync(key){try{return JSON.parse(localStorage.getItem(key))??''}catch(e){return''}},
  setStorageSync(key,value){localStorage.setItem(key,JSON.stringify(value))},removeStorageSync(key){localStorage.removeItem(key)},getStorageInfoSync(){return{keys:Object.keys(localStorage)}},
  switchTab({url}){history=[];navigate(url)},navigateTo({url}){if(route)history.push(route);navigate(url)},redirectTo({url}){navigate(url)},reLaunch({url}){history=[];navigate(url)},navigateBack(){navigate(history.pop()||'/pages/index/index')},
  setNavigationBarTitle({title}){document.getElementById('page-title').textContent=title},
  showModal:modal,showToast({title}){const toast=document.getElementById('toast');toast.textContent=title;toast.style.display='block';setTimeout(()=>toast.style.display='none',2400)}
 }
 function evaluate(code,scope){return new Function('scope','with(scope){return ('+code+')}')(scope)}
 function value(text,scope){if(!text)return'';const exact=text.match(/^{{((?:(?!{{|}})[\s\S])*)}}$/);if(exact)return evaluate(exact[1],scope);return text.replace(/{{([\s\S]*?)}}/g,(_,code)=>String(evaluate(code,scope)??''))}
 function invoke(inst,name,event){if(inst[name])inst[name](event)}
 function event(el,detail){return{currentTarget:{dataset:Object.assign({},el.dataset)},detail:detail||{}}}
 function children(parent,scope,inst){
  const fragment=document.createDocumentFragment();let lastCondition=false
  for(const child of parent.childNodes){
   if(child.nodeType===3){fragment.append(document.createTextNode(value(child.textContent,scope)));continue}
   if(child.nodeType!==1)continue
   if(child.hasAttribute('wx:else')){if(lastCondition)continue}
   else if(child.hasAttribute('wx:if')){lastCondition=!!value(child.getAttribute('wx:if'),scope);if(!lastCondition)continue}
   else if(child.hasAttribute('wx:elif')){if(lastCondition)continue;lastCondition=!!value(child.getAttribute('wx:elif'),scope);if(!lastCondition)continue}
   const loop=child.getAttribute('wx:for')
   if(loop){const values=value(loop,scope)||[];values.forEach((item,index)=>{fragment.append(node(child,Object.assign({},scope,{[child.getAttribute('wx:for-item')||'item']:item,[child.getAttribute('wx:for-index')||'index']:index}),inst))})}
   else fragment.append(node(child,scope,inst))
  }
  return fragment
 }
 function parse(wxml){const doc=new DOMParser().parseFromString('<root xmlns:wx="urn:wx">'+wxml.replace(/\bwx:else(?=\s|>)/g,'wx:else=""').replace(/{{[\s\S]*?}}/g,expression=>expression.replace(/</g,'&lt;')).replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g,'&amp;')+'</root>','application/xml');if(doc.querySelector('parsererror'))throw new Error(doc.querySelector('parsererror').textContent);return doc.documentElement}
 function node(source,scope,inst){
  const tag=source.tagName
  if(tag==='block')return children(source,scope,inst)
  if(tag==='identity-switcher'){
   let component=componentInstances.get('identity-switcher')
   if(!component){let spec;new Function('Component','require','wx',files['components/identity-switcher/index.js'])(s=>spec=s,n=>requireModule(resolve('components/identity-switcher/index.js',n)),window.wx);component=instance(spec);componentInstances.set('identity-switcher',component)}
   component.data.context=value(source.getAttribute('context'),scope)
   component.triggerEvent=(name,detail)=>invoke(inst,source.getAttribute('bind'+name),{detail})
   const el=document.createElement('identity-switcher');el.append(children(parse(files['components/identity-switcher/index.wxml']),component.data,component));return el
  }
  if(tag==='picker'&&source.getAttribute('mode')==='region'){
   const wrapper=document.createElement('view');wrapper.className='region-columns'
   const sample={'福建省':{'宁德市':['福安市','福鼎市','霞浦县','蕉城区','古田县','屏南县','寿宁县','周宁县','柘荣县']},'浙江省':{'温州市':['泰顺县']}}
   const region=(value(source.getAttribute('value'),scope)||['福建省','宁德市','福安市']).slice()
   const ranges=[Object.keys(sample),Object.keys(sample[region[0]]||{}),((sample[region[0]]||{})[region[1]]||[])]
   ranges.forEach((choices,index)=>{const el=document.createElement('select');el.className='input';const blank=document.createElement('option');blank.value='';blank.textContent=['请选择省','请选择市','请选择区县'][index];el.append(blank);for(const choice of choices){const option=document.createElement('option');option.value=choice;option.textContent=choice;option.selected=scope.regionChosen&&region[index]===choice;el.append(option)}el.onchange=()=>{if(!el.value)return;region[index]=el.value;if(index===0){region[1]=Object.keys(sample[region[0]])[0];region[2]=sample[region[0]][region[1]][0]}if(index===1)region[2]=sample[region[0]][region[1]][0];invoke(inst,source.getAttribute('bindchange'),event(el,{value:region}))};wrapper.append(el)})
   return wrapper
  }
  if(tag==='picker'){
   const el=document.createElement('select');el.className='input';const choices=value(source.getAttribute('range'),scope)||[]
   let selected=source.hasAttribute('value')?Number(value(source.getAttribute('value'),scope)):choices.indexOf(scope.item)
   const rawCopy=source.textContent
   const roleEmpty=rawCopy.includes('请选择角色')&&scope.applicationRoleIndex<0, townEmpty=rawCopy.includes('请选择乡镇')&&scope.townIndex<0
   if(roleEmpty||townEmpty){selected=-1;const blank=document.createElement('option');blank.value='';blank.textContent=roleEmpty?'请选择角色':'请选择乡镇 / 街道';el.append(blank)}
   for(const choice of choices){const option=document.createElement('option');option.textContent=choice;option.value=choices.indexOf(choice);option.selected=selected===choices.indexOf(choice);el.append(option)}
   el.disabled=source.hasAttribute('disabled')&&!!value(source.getAttribute('disabled'),scope)
   for(const attr of source.attributes)if(attr.name.startsWith('data-'))el.setAttribute(attr.name,value(attr.value,scope))
   el.onchange=()=>{if(el.value!=='')invoke(inst,source.getAttribute('bindchange'),event(el,{value:el.value}))};return el
  }
  if(tag==='checkbox'){
   const el=document.createElement('span');el.className='checkbox-wrap';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=source.getAttribute('value');checkbox.checked=!!value(source.getAttribute('checked'),scope);el.append(checkbox);return el
  }
  const el=document.createElement(tag==='image'?'img':tag)
  for(const attr of source.attributes){
   if(attr.name.startsWith('wx:')||attr.name.startsWith('bind')||attr.name.startsWith('catch'))continue
   const val=value(attr.value,scope)
   if(attr.name==='src'&&tag==='image'){el.setAttribute('src',assetUrl(val));continue}
   if(attr.name==='disabled'){el.disabled=!!val;continue}
   if(attr.name==='value'){el.value=String(val??'');continue}
   if(attr.name==='mode'){el.setAttribute('data-mode',val);continue}
   if(attr.name==='password'&&tag==='input'){el.type=val?'password':'text';continue}
   if(attr.name==='type'&&tag==='input'){if(!source.hasAttribute('password'))el.type='text';el.inputMode=attr.value==='digit'?'decimal':'text';continue}
   el.setAttribute(attr.name,String(val??''))
  }
  if(tag==='input'||tag==='textarea'){
   el.dataset.previewKey='input-'+sequence++
   el.addEventListener('input',()=>invoke(inst,source.getAttribute('bindinput'),event(el,{value:el.value})))
  }
  if(tag==='checkbox-group'){el.addEventListener('change',()=>invoke(inst,source.getAttribute('bindchange'),event(el,{value:[...el.querySelectorAll('input:checked')].map(i=>i.value)})))}
  const tap=source.getAttribute('bindtap')||source.getAttribute('catchtap')
  if(tap)el.addEventListener('click',e=>{if(source.hasAttribute('catchtap'))e.stopPropagation();invoke(inst,tap,event(el))})
  if(!['image','input'].includes(tag))el.append(children(source,scope,inst))
  return el
 }
 function css(text){return text.replace(/\/\*[\s\S]*?\*\//g,'').replace(/([\d.]+)rpx/g,'calc($1 * var(--rpx))').replace(/(^|})\s*([^{}]+)\{/g,(_,boundary,selectors)=>boundary+' '+selectors.split(',').map(s=>s.trim()==='page'?'#screen':'#screen '+s.trim()).join(',')+' {')}
 function render(){
  if(!page||rendering)return;rendering=true
  try{
   const active=document.activeElement,key=active&&active.dataset.previewKey,start=active&&active.selectionStart,scroll=screen.scrollTop
   sequence=0;screen.replaceChildren(children(parse(files[page.path+'.wxml']),page.data,page))
   const focused=key&&screen.querySelector('[data-preview-key="'+key+'"]');if(focused){focused.focus({preventScroll:true});if(start!==null&&focused.setSelectionRange)focused.setSelectionRange(start,start)}screen.scrollTop=scroll
   sidebar()
  }catch(e){screen.innerHTML='';const error=document.createElement('div');error.className='stage-error';error.textContent=e.message;screen.append(error);console.error(e)}finally{rendering=false}
 }
 function navigate(url){
  const parsed=new URL(url,'http://preview'), path=parsed.pathname.replace(/^\//,'')
  if(!config.pages.includes(path))throw new Error('页面未注册：'+path)
  route=parsed.pathname+parsed.search;componentInstances.clear()
  let spec;new Function('Page','require','wx',files[path+'.js'])(s=>spec=s,n=>requireModule(resolve(path+'.js',n)),window.wx)
  page=instance(spec);page.path=path
  const title=JSON.parse(files[path+'.json']).navigationBarTitleText||'乡桥';wx.setNavigationBarTitle({title})
  const style=document.getElementById('native-style')||document.createElement('style');style.id='native-style';style.textContent=css(files['app.wxss']+'\n'+files[path+'.wxss']+'\n'+files['components/identity-switcher/index.wxss']);document.head.append(style)
  if(page.onLoad)page.onLoad(Object.fromEntries(parsed.searchParams));if(page.onShow)page.onShow()
  screen.scrollTop=0;render();renderTabs();history.length?document.getElementById('back').style.visibility='visible':document.getElementById('back').style.visibility='hidden'
 }
 function renderTabs(){const tabs=document.getElementById('tabs'),isTab=config.tabBar.list.some(item=>item.pagePath===page.path);tabs.hidden=!isTab;tabs.style.display=isTab?'flex':'none';document.querySelector('.phone').classList.toggle('detail-page',!isTab);tabs.replaceChildren();if(!isTab)return;for(const item of config.tabBar.list){const button=document.createElement('button'),active=page.path===item.pagePath;button.className=active?'active':'';const img=document.createElement('img');img.src=assetUrl(active?item.selectedIconPath:item.iconPath);const label=document.createElement('span');label.textContent=item.text;button.append(img,label);button.onclick=()=>wx.switchTab({url:'/'+item.pagePath});tabs.append(button)}}
 function addLink(parent,label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;parent.append(b)}
 function sidebar(){
  const catalog=requireModule('utils/catalog.js'), session=requireModule('utils/session.js'), business=requireModule('utils/business-groups.js'), ctx=session.current()
  const roleLinks=document.getElementById('role-links');roleLinks.replaceChildren()
  if(requireModule('utils/connection.js').enabled()) {roleChooser.update([], '',()=>{});const links=document.getElementById('module-links');links.replaceChildren();addLink(links,'数据库工作台',()=>wx.navigateTo({url:'/pages/connected/connected'}));addLink(links,'数据库登录',()=>wx.navigateTo({url:'/pages/login/login'}));return}
  function chooseIdentity(account,identity){const perform=()=>{if(!session.current()||session.current().account.id!==account.id)session.login(account.id);session.switchIdentity(identity.id);wx.switchTab({url:'/pages/workspace/workspace'})};if(ctx&&ctx.account.id!==account.id)wx.showModal({title:'切换演示账号',content:'只切换演示会话，各账号草稿独立保留。仅用于展示角色UI，不申请真实角色权限。',success:r=>{if(r.confirm)perform()}});else perform()}
  const choices=[]
  for(const account of catalog.accounts)for(const identity of account.identities){addLink(roleLinks,identity.label+' · '+account.name,()=>chooseIdentity(account,identity));choices.push({value:account.id+'|'+identity.id,label:identity.label+' · '+account.name})}
  roleChooser.update(choices,ctx?ctx.account.id+'|'+ctx.identity.id:'',next=>{const[accountId,identityId]=next.split('|'),account=catalog.accounts.find(a=>a.id===accountId),identity=account&&account.identities.find(i=>i.id===identityId);if(identity)chooseIdentity(account,identity)})
  const links=document.getElementById('module-links');links.replaceChildren()
  if(ctx){if(catalog.hasCards(ctx.identity.role))addLink(links,'我的农事卡',()=>wx.navigateTo({url:'/pages/cards/cards'}));for(const group of business.groups(catalog.modules(ctx.identity.role))){const title=document.createElement('h2');title.textContent=group.title;links.append(title);for(const m of group.modules)addLink(links,m.title,()=>wx.navigateTo({url:business.route(m.id)}))}}
  else addLink(links,'请先选择演示身份',()=>wx.navigateTo({url:'/pages/login/login'}))
 }
 for(const [title,url] of [['首页','/pages/index/index'],['工作台','/pages/workspace/workspace'],['乡桥农场','/pages/farm/farm'],['消息','/pages/message/message'],['我的','/pages/me/me'],['登录与身份选择','/pages/login/login'],['成员准入与申请','/pages/module/module?id=application']])addLink(document.getElementById('public-links'),title,()=>config.tabBar.list.some(item=>'/'+item.pagePath===url)?wx.switchTab({url}):wx.navigateTo({url}))
 document.getElementById('back').onclick=()=>wx.navigateBack()
 navigate('/pages/index/index')
})().catch(error=>{document.getElementById('screen').textContent='原型加载失败：'+error.message;console.error(error)})
