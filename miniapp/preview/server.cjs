// Local-only preview. Optional fixed loopback proxy; never proxies production APIs.
const http=require('node:http'), fs=require('node:fs'), path=require('node:path')
const root=path.resolve(__dirname,'..'), port=Number(process.env.XQ_PREVIEW_PORT||4193)
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.wxml':'text/plain; charset=utf-8','.wxss':'text/plain; charset=utf-8'}
const server=http.createServer((req,res)=>{
 try {
  const url=new URL(req.url,'http://127.0.0.1'), decoded=decodeURIComponent(url.pathname)
  if(decoded.startsWith('/api/v1/')&&process.env.XQ_PREVIEW_BACKEND==='1'){
   const upstream=http.request({hostname:'127.0.0.1',port:8080,path:decoded+url.search,method:req.method,headers:{...req.headers,host:'127.0.0.1:8080'}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res)})
   upstream.setTimeout(15000,()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({code:502,message:'本地接口不可用'}))});req.pipe(upstream);return
  }
  if(decoded==='/source-bundle'||decoded==='/source-bundle.json'){
   const config=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')), files={}
   const paths=['app.wxss','utils/catalog.js','utils/session.js','utils/connection.js','utils/module-ui.js','utils/address.js','utils/farm-data.js','utils/message-ui.js','utils/support.js','utils/value-data.js','utils/business-groups.js','utils/business-groups-data.js',...config.pages.flatMap(p=>[p+'.js',p+'.wxml',p+'.wxss',p+'.json']),...['js','wxml','wxss'].map(e=>'components/identity-switcher/index.'+e)]
   paths.forEach(p=>{files[p]=fs.readFileSync(path.join(root,p),'utf8')})
   res.writeHead(200,{'Content-Type':mime['.json'],'Cache-Control':'no-store'});res.end(JSON.stringify({config,files}));return
  }
  const local=decoded==='/'?'preview/index.html':decoded.replace(/^\//,'')
  const target=path.resolve(root,local)
  if(!target.startsWith(root+path.sep)||!['preview/','assets/'].some(p=>local.startsWith(p))) {res.writeHead(404);res.end('Not found');return}
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).on('error',()=>res.end('Not found')).pipe(res)
 }catch(error){res.writeHead(500);res.end('Preview error')}
})
server.listen(port,'127.0.0.1',()=>console.log('乡桥小程序UI预览 http://127.0.0.1:'+port+'（不是微信模拟器）'))
