const registry=require('./business-groups-data')
function groups(modules) {
 const available=new Map(modules.map(item=>[item.id,item]))
 return registry.map(group=>({id:group.id,title:group.title,modules:group.entries.flatMap(entry=>{
  const variants=entry.members.filter(id=>available.has(id)).map(id=>available.get(id))
  if(!variants.length)return[]
  return[Object.assign({},variants[0],{title:variants.length===1?variants[0].title:entry.title,variants})]
 })})).filter(group=>group.modules.length)
}
function route(id) {
 if(id==='value-feedback')return'/pages/help/help'
 if(id==='cards')return'/pages/cards/cards'
 return id.startsWith('value-')?'/pages/value/value?view='+id.slice(6):'/pages/module/module?id='+id
}
function related(modules,id) { for(const group of groups(modules))for(const entry of group.modules)if(entry.variants.some(m=>m.id===id))return entry.variants;return[] }
module.exports={groups,route,related}
