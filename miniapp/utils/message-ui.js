const catalog=require('./catalog')
function messages(role){
 const common=[{id:'system',category:'系统',title:'数据授权与隐私提醒',copy:'切换身份不扩大权限，代办、公开、签约应分别授权。',target:null}]
 const rows=catalog.modules(role).slice(0,3).map((m,index)=>({id:'business-'+m.id,category:['services','protection','assets'].includes(m.id)?'服务':'农事',title:m.title+'待办（示例）',copy:m.summary+' '+m.caution,target:{type:'module',id:m.id},date:'产季示例消息 '+(index+1)}))
 if(catalog.hasCards(role))rows.unshift({id:'card',category:'农事',title:'A/B/C设置等待设备确认（示例）',copy:'这是状态展示样例，不代表您已保存真实配置。目标版本与设备确认版本应分别核对。',target:{type:'cards'}})
 rows.push({id:'farm',category:'农场',title:'农场生产更新提醒（示例）',copy:'仅展示通知形式；未推送实际生产更新。可进入公开农场查看原型。',target:{type:'farm'}})
 return rows.concat(common).map(m=>Object.assign({date:'演示消息 · 非真实通知'},m))
}
module.exports={messages}
