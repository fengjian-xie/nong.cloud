// Static browser demo only: no Node server, private config, WeChat upload or API proxy.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process')
const root=path.resolve(__dirname,'..'),destination=path.resolve(process.argv[2]||path.join(root,'../output/releases/2026-10-06-architecture-v4.1/deployment/miniapp-preview.tar.gz'))
if(fs.existsSync(destination))throw new Error('演示发布包已存在，请换版本，不能覆盖')
const config=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')),files={}
const sources=['app.wxss',...['catalog','session','connection','module-ui','address','farm-data','message-ui','support','value-data','business-groups','business-groups-data'].map(n=>'utils/'+n+'.js'),...config.pages.flatMap(p=>['.js','.json','.wxss','.wxml'].map(e=>p+e)),...['js','wxml','wxss'].map(e=>'components/identity-switcher/index.'+e)]
for(const source of sources)files[source]=fs.readFileSync(path.join(root,source),'utf8')
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'xiangqiao-static-preview-')),out=path.join(stage,'prototype')
fs.mkdirSync(path.join(out,'preview'),{recursive:true})
fs.copyFileSync(path.join(root,'preview/index.html'),path.join(out,'index.html'))
for(const name of ['shell.css','choice-menu.css','choice-menu.js','runtime.js'])fs.copyFileSync(path.join(root,'preview',name),path.join(out,'preview',name))
fs.cpSync(path.join(root,'assets'),path.join(out,'assets'),{recursive:true})
fs.writeFileSync(path.join(out,'source-bundle.json'),JSON.stringify({config,files}))
fs.mkdirSync(path.dirname(destination),{recursive:true})
execFileSync('/usr/bin/tar',['-czf',destination,'prototype'],{cwd:stage,env:{...process.env,COPYFILE_DISABLE:'1'}})
console.log(JSON.stringify({bundle:destination,sha256:crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex'),stage,registeredRoutes:config.pages.length,sourceFiles:sources.length,mode:'public-local-demo-no-backend'}))
