// Convert existing VI vectors and supplied photographs to native-compatible assets.
const fs = require('node:fs'), path = require('node:path')
const sharp = require(process.env.XQ_SHARP_PACKAGE || 'sharp')
const root = path.resolve(__dirname, '..'), brand = path.resolve(root, '../admin-web/public/brand'), out = path.join(root, 'assets')
const paths = {
 home: '<path d="m8 29 24-20 24 20M13 25v30h15V38h8v17h15V25"/>',
 work: '<rect x="10" y="10" width="18" height="18" rx="3"/><rect x="36" y="10" width="18" height="18" rx="3"/><rect x="10" y="36" width="18" height="18" rx="3"/><rect x="36" y="36" width="18" height="18" rx="3"/>',
 farm: '<path d="M32 56V31M32 44C9 43 9 26 12 17c15 2 23 11 20 27Zm0-7C31 17 45 9 55 10c1 14-6 26-23 27Z"/>',
 message: '<path d="M10 12h44v34H31L17 55v-9h-7Z"/><circle cx="21" cy="28" r="1"/><circle cx="32" cy="28" r="1"/><circle cx="43" cy="28" r="1"/>',
 me: '<circle cx="32" cy="21" r="11"/><path d="M10 57c0-26 44-26 44 0"/>'
}
async function run() {
 fs.mkdirSync(out,{ recursive:true })
 await sharp(path.join(brand,'xiangqiao-vi-mark.svg')).resize(160,160).png().toFile(path.join(out,'vi-mark.png'))
 for (const [name,shape] of Object.entries(paths)) for (const active of [false,true]) {
  const color=active?'#0F3D2E':'#747B75', fill=name==='work'&&active?color:'none'
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="'+fill+'" stroke="'+color+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'+shape+'</svg>'
  await sharp(Buffer.from(svg)).png().toFile(path.join(out,'tab-'+name+(active?'-active':'')+'.png'))
 }
 for (const [source,target] of [['fuan-farm-aerial-v1.jpg','fuan-farm.jpg'],['fuan-vineyard.jpg','vineyard.jpg'],['xiangqiao-card-vi-v1.jpg','card.jpg']]) await sharp(path.join(brand,source)).resize({width:1000,withoutEnlargement:true}).jpeg({quality:82}).toFile(path.join(out,target))
 console.log('Converted VI mark, 10 tab icons and 3 existing image assets.')
}
run().catch(error=>{ console.error(error); process.exitCode=1 })
