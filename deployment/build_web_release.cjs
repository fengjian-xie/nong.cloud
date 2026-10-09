// Build upload artifacts from the verified public files, never from repository-wide globs.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process')
const root=path.resolve(__dirname,'..'),release=path.join(root,'output/releases/2026-10-06-architecture-v4.1'),out=path.join(release,'deployment')
const refresh=process.argv.includes('--refresh-scripts'),previous=refresh?JSON.parse(fs.readFileSync(path.join(out,'release-manifest.json'),'utf8')):null
if(previous&&previous.status!=='prepared-not-deployed')throw new Error('不能覆盖已发布的清单')
const sites=[['home','nong.cloud'],['admin','m.nong.cloud'],['farm','nc.nong.cloud'],['api','api.nong.cloud'],['work','work.nong.cloud']]
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'xiangqiao-v41-upload-'))
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const packages=[]
for(const [name,domain]of sites){
 const folder=path.join(release,'web',domain),packagePath=path.join(out,name+'-v4.1.tar.gz')
 if(refresh){const old=previous.packages.find(p=>p.site===name);if(!old||sha(packagePath)!==old.sha256)throw new Error('不可变发布包已变化：'+name)}
 else {
  if(fs.existsSync(packagePath))throw new Error('发布包已存在，拒绝覆盖：'+packagePath)
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'xiangqiao-'+name+'-v41-')),dist=path.join(work,'dist')
  fs.mkdirSync(dist)
  for(const entry of ['index.html','assets','brand'])fs.cpSync(path.join(folder,entry),path.join(dist,entry),{recursive:true})
  execFileSync('/usr/bin/tar',['-czf',packagePath,'dist'],{cwd:work,env:{...process.env,COPYFILE_DISABLE:'1'}})
 }
 fs.copyFileSync(packagePath,path.join(stage,path.basename(packagePath)))
 packages.push({site:name,domain,name:path.basename(packagePath),sha256:sha(packagePath),bytes:fs.statSync(packagePath).size})
}
const prototype=path.join(out,'miniapp-preview-v2.tar.gz')
fs.copyFileSync(prototype,path.join(stage,'miniapp-preview-v2.tar.gz'))
packages.push({site:'prototype',domain:'work.nong.cloud',name:'miniapp-preview-v2.tar.gz',path:'/miniapp-preview/',sha256:sha(prototype),bytes:fs.statSync(prototype).size})
const scripts=['update_admin_site.py','update_subject_site.py','update_api_portal.py','deploy_home_site.py','deploy_api_site.py','deploy_cloud_farm.py','miniapp_preview.py','inspect_web_release.py']
for(const name of scripts)fs.copyFileSync(path.join(__dirname,name),path.join(stage,name))
const manifest={version:'V4.1-web-plus-miniapp-preview',status:'prepared-not-deployed',packages,scripts:scripts.map(name=>({name,sha256:sha(path.join(__dirname,name))}))}
fs.writeFileSync(path.join(out,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n')
fs.copyFileSync(path.join(out,'release-manifest.json'),path.join(stage,'release-manifest.json'))
console.log(JSON.stringify({stage,out,...manifest}))
