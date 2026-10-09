// Export public frontend artifacts only. No SSH, deployment credentials or caches.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process')
const version=process.argv[2]||'v4'
if(!/^v\d+(\.\d+)?$/.test(version))throw new Error('版本格式须为v4或v4.1')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/releases/2026-10-06-architecture-'+version)
const packages=['xiangqiao-frontend-source-'+version+'.zip','xiangqiao-web-five-sites-'+version+'.zip'],mini='xiangqiao-miniapp-'+version+'.zip'
for(const name of [...packages,mini,'manifest.json'])if(fs.existsSync(path.join(out,name)))throw new Error('交接包已存在，请换版本，不能覆盖：'+name)
const sites=[['nong.cloud','home-site','/brand-site/'],['m.nong.cloud','admin-site','/fuan-ui/'],['nc.nong.cloud','farm-site','/'],['api.nong.cloud','api-site','/'],['work.nong.cloud','work-site','/']]
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'xiangqiao-'+version+'-source-')),source=path.join(stage,'xiangqiao-frontend')
fs.mkdirSync(source)
const adminFiles=['src','public','index.html','package.json','package-lock.json','tsconfig.app.json','tsconfig.node.json','tsconfig.json','vite.config.ts','eslint.config.js']
fs.mkdirSync(path.join(source,'admin-web'))
for(const name of adminFiles){const file=path.join(root,'admin-web',name);if(fs.existsSync(file))fs.cpSync(file,path.join(source,'admin-web',name),{recursive:true})}
fs.copyFileSync(path.join(out,'README.md'),path.join(source,'README.md'))
fs.mkdirSync(path.join(source,'docs'))
for(const name of ['乡桥全栈递归审查-V3-2026-10-06.md','乡桥全栈架构递归复查-2026-10-06.md'])fs.copyFileSync(path.join(root,'docs',name),path.join(source,'docs',name))
execFileSync(process.execPath,[path.join(__dirname,'package-prototype.cjs'),path.join(out,mini)],{stdio:'inherit'})
execFileSync('/usr/bin/unzip',['-q',path.join(out,mini),'-d',stage])
fs.renameSync(path.join(stage,'xiangqiao-miniapp'),path.join(source,'miniapp'))
fs.copyFileSync(path.join(out,'README.md'),path.join(source,'HANDOFF.md'))
for(const [domain]of sites)if(!fs.existsSync(path.join(out,'web',domain,'index.html')))throw new Error('缺少构建：'+domain)
execFileSync('/usr/bin/zip',['-qr',path.join(out,packages[0]),'xiangqiao-frontend'],{cwd:stage})
execFileSync('/usr/bin/zip',['-qr',path.join(out,packages[1]),'web','README.md'],{cwd:out})
const files=[...packages,mini].map(name=>({name,bytes:fs.statSync(path.join(out,name)).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(out,name))).digest('hex')}))
const manifest={version:version+'-architecture-ui',status:'local-prototype-not-deployed',sites:sites.map(([domain,mode,base])=>({domain,mode,base})),files}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify({out,stage,...manifest}))
