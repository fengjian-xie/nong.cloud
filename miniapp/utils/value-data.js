// Explicit fixtures for UI, not production data, device receipts or quality evidence.
const titles={passport:'产品批次履历',calendar:'采收供货日历',stories:'产季记录',income:'经营净收益',grades:'分级货源匹配',history:'跨年经营对比',collaboration:'协同与缺项提醒',feedback:'履约反馈'}
const roleViews={farmer:Object.keys(titles),cooperative:Object.keys(titles),family:['passport','stories','history'],buyer:['passport','calendar','grades','feedback'],processor:['passport','calendar','grades','feedback'],warehouse:['passport','grades'],supplier:['collaboration'],machine:['collaboration'],team:['collaboration'],protection:['collaboration'],lab:['collaboration'],consumer:['passport','calendar','feedback']}
const publicViews=['passport','calendar']
const definitions=Object.fromEntries(Object.entries(titles).map(([id,title])=>['value-'+id,[title,'将农事依据连接批次、供货与经营。','本地原型，不跨端发布；记录不等于认证，意向不等于成交。']]))
const sample={
passport:[['公开批次','HV-SZT-001-2026-01（示例）'],['产品/产区','福安葡萄 / 福建·福安（示例）'],['经营主体','匿名示例，待核验'],['农事依据','核验流程示例，未接入真实卡片'],['土壤/产品检测','土壤报告非食品检测；真实报告待接入'],['采收/交接','待实物核对；混合批须另建并关联全部来源']],
calendar:[['成熟窗口','2026-09-05附近（演示历史基准，非今天承诺）'],['供货数量','0–14000kg（预测示例，非现货）'],['来源与更新','示例日期2026-08-29，采前须人工确认'],['关注/询价','本机草稿，不发通知或订单']],
stories:[['来源','仅演示核验记录摘要'],['编辑与授权','子女需额外授权；保存仍待本人确认'],['公开','没有自动发布接口，不编造农户发言']],
income:[['私有经营账','仅生产身份，不向买家展示底价'],['现金/完整成本','家庭劳动单独计入'],['销售相关成本','包装、冷链、配送、售后与卡片分摊'],['价格参考','成本×1.35，仅协商参考，不保证收益']],
grades:[['数量单位','kg / 斤，1斤=0.5kg'],['用途与等级','鲜食、加工及尾货需求分开'],['质量边界','B级不等于不合格；异常货排除'],['库存','不锁库，实物与货主授权待核对']],
history:[['2024产季','15000kg（档案示例，非当前主体实收）'],['2025产季','16200kg（档案示例，非当前主体实收）'],['2026产季','18000kg（预测示例，非实际产量）'],['成本与品质','缺项，不编造对比或质量提升率']],
collaboration:[['农事缺项','地块归属与实际施用待核对'],['检测缺项','报告来源和适用范围待独立核验'],['服务协同','作业技能用标签，按资质与时间安排'],['专业判断','系统不自动给出药量或处方']],
feedback:[['关联对象','批次、订单与交付证据待真实接入'],['处理方式','帮助中心独立受理，不自动退款或公开评分'],['回流生产','双方证据核实后再形成改进事项']]
}
const incomeLabels={revenue:'销售收入 / 元',materials:'实际施用农资 / 元',services:'农服农机 / 元',other:'其他生产成本 / 元',packaging:'包装 / 元',coldChain:'冷链仓储 / 元',delivery:'配送 / 元',afterSale:'售后损耗费用 / 元',card:'农事卡分摊 / 元',laborDays:'确认出工 / 人天',dayRate:'参考日工资 / 元',quantityKg:'对应产品数量 / kg'}
const initialIncome={revenue:'0',materials:'0',services:'0',other:'0',packaging:'0',coldChain:'0',delivery:'0',afterSale:'0',card:'100',laborDays:'0',dayRate:'180',quantityKg:'0'}
function views(role){return roleViews[role]||[]}
function number(value,positive=false){if(typeof value!=='string'||!/^\d+(\.\d{1,2})?$/.test(value)||Number(value)>100000000||(positive&&Number(value)<=0))throw new Error('请填写完整非负数字，最多两位小数；对应数量须为正数。');return Number(value)}
function estimate(input){const cents=k=>Math.round(number(input[k])*100),revenue=cents('revenue'),cash=['materials','services','other','packaging','coldChain','delivery','afterSale','card'].reduce((s,k)=>s+cents(k),0),labor=Math.round(number(input.laborDays)*cents('dayRate')),full=cash+labor,quantity=number(input.quantityKg,true);if(![revenue,cash,labor,full,Math.round(full/quantity*1.35)].every(Number.isSafeInteger))throw new Error('计算超出安全金额范围');return{cashNet:((revenue-cash)/100).toFixed(2),fullNet:((revenue-full)/100).toFixed(2),fullCost:(full/100).toFixed(2),unit:(full/100/quantity).toFixed(2),reference:(full/100/quantity*1.35).toFixed(2)}}
const stocks=[{id:'BATCH-001',product:'阳光玫瑰葡萄',grade:'B级',kg:1500,date:'2026-09-08',quality:'待实物验收',shared:true},{id:'BATCH-003',product:'夏黑葡萄',grade:'B级',kg:900,date:'2026-09-06',quality:'待实物验收',shared:true},{id:'BAD-DEMO',product:'葡萄',grade:'B级',kg:3000,date:'2026-09-08',quality:'异常隔离',shared:true}]
function match(product,grade,quantity,unit){if(!product.trim()||!['A级','B级','C级'].includes(grade)||!['kg','斤'].includes(unit))throw new Error('请选择有效的产品、等级和单位');const kg=number(quantity,true)*(unit==='斤'?.5:1);return{kg,rows:stocks.filter(s=>s.shared&&s.product.includes(product.trim())&&s.grade===grade&&s.kg>=kg&&s.quality!=='异常隔离'&&s.date>='2026-08-29')}}
function story(role){if(!['farmer','cooperative'].includes(role))throw new Error('当前身份未获额外产季记录整理授权；不能自行开通');return '这一季的葡萄（核验记录示例草稿）\n2026-08-27：修剪记录核验示例。\n本段未引用真实设备事件，采收、检测与交付待确认。不能作为绿色、有机或无农残承诺。'}
function spec(id){return definitions[id]?{fields:[],sample:sample[id.slice(6)]||[],steps:['确认来源','核对授权','独立复核','真实履约待接入']}:null}
module.exports={titles,definitions,publicViews,views,sample,incomeLabels,initialIncome,estimate,match,story,spec}
