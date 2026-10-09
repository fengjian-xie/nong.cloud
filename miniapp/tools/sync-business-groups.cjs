// Mechanical build of the native JS module from the shared JSON registry.
const fs=require('node:fs'),path=require('node:path')
const root=path.resolve(__dirname,'..')
const registry=JSON.parse(fs.readFileSync(path.join(root,'utils/business-groups.json'),'utf8'))
const content='// Generated from business-groups.json; edit the registry, not this file.\nmodule.exports = '+JSON.stringify(registry,null,2)+'\n'
const target=path.join(root,'utils/business-groups-data.js')
if(process.argv.includes('--check')) {
 if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==content)throw new Error('运行 node tools/sync-business-groups.cjs 同步业务分组')
 console.log('Shared business groups: up to date')
} else {fs.writeFileSync(target,content);console.log('Shared business groups: native module generated')}
