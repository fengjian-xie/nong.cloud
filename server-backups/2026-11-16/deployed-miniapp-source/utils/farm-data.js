const farms = [
 { id:'shizi-demo',title:'狮子头葡萄园（示例）',region:'福安赛岐',crop:'葡萄产季示例',image:'/assets/fuan-farm.jpg',camera:'待接入',plan:'待运营方确认',operator:'农场经营主体待核实' },
 { id:'vineyard-demo',title:'福安葡萄产区（示例）',region:'福安',crop:'葡萄产季示例',image:'/assets/vineyard.jpg',camera:'待接入',plan:'待运营方确认',operator:'农场经营主体待核实' }
]
const timeline = [
 { id:'t1',date:'产季第1阶段（示例）',title:'修剪与田间管理',copy:'按授权关联作业记录、地块匹配和代办确认。',state:'虚构流程示例' },
 { id:'t2',date:'产季第2阶段（示例）',title:'肥力检测与投入核对',copy:'机构报告与建议独立核验；购买不等于实际施用。',state:'虚构流程示例' },
 { id:'t3',date:'产季第3阶段（示例）',title:'疏果、套袋与生长观察',copy:'记录生产更新，媒体公开前确认地块授权。',state:'虚构流程示例' },
 { id:'t4',date:'采收阶段（示例）',title:'成熟、交接与配送',copy:'实际成熟、数量与配送安排须运营方确认。',state:'未形成真实履约' }
]
const tracking=[
 {title:'认购意向',copy:'本地草稿，不向经营主体发送。'},
 {title:'方案与合同确认',copy:'实际价格、份额、权利义务和签署接口待接入。'},
 {title:'生产跟踪',copy:'当前只展示示例流程，不代表实际作业进度。'},
 {title:'采收与验收',copy:'实际产品、数量、等级与验收标准待确认。'},
 {title:'配送与售后',copy:'无真实物流单号；不能宣称已发货、已收货。'}
]
module.exports={farms,timeline,tracking}
