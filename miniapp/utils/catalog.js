// Fixture identities demonstrate UI only, never production authorization.
const roleNames = { farmer: '种植户', cooperative: '合作社', buyer: '采购商', supplier: '农资商', machine: '农机服务', team: '农服队', protection: '植保团队', warehouse: '冷库', processor: '加工分拣', lab: '检测机构', family: '子女代办', consumer: '消费者' }
const definitions = {
plots: ['地块与产季', '记录边界、面积、海拔与多年种植情况。', '修改已提交作物须照片、视频和审核版本；GPS不证明权属。'],
records: ['农事记录', '查看作业时间、地块匹配和待确认记录。', '购买不等于施用，按键次数不等于出工天数。'],
costs: ['成本与定价', '按确认工时、农资实际施用和当地行情估算。', '现金成本与完整成本分别核算；成本×1.35仅作报价参考。'],
soil: ['土壤肥力', '归档采样、机构报告和建议施肥方案。', '机构建议不是自动施肥指令，报告需独立核验。'],
services: ['农事服务', '共用接单、作业、完工、独立验收和争议流程。', '服务方不得自行验收；同一人双身份须独立复核。'],
sales: ['供货意向', '关联产季、成熟时间、规模与交接要求。', '意向不构成收购承诺；私人成本不默认公开。'],
authorization: ['家庭授权', '按主体、范围、有效期管理代办。', '子女代办不自动拥有签约、收款或公开权限。'],
members: ['社员与调度', '查看社员档案与协同任务。', '成员准入和地块授权分别审核。'],
nfc: ['识卡与关联', '农资、农机、农服、收购按授权关联凭据。', 'NFC与BLE待硬件联调；贴卡不是付款、验收或授权凭据。'],
receipts: ['农资凭据', '记录商品、批次、数量与退货。', '销售凭据与农户实际施用记录分开保存。'],
assets: ['设备与队伍', '管理机具、作业人员与服务能力。', '示例设备状态不代表实际在线。'],
protection: ['植保作业', '补充作物、药剂、批次、天气和安全间隔。', '方案须专业确认，系统不自动推荐药量。'],
maturity: ['成熟货源', '了解哪里、何时成熟及规模。', '查看授权摘要，不含农户私人定位、成本和家庭资料。'],
demands: ['采购与尾货需求', '发布采购规格及分拣车间补货需求。', 'B级货不等于不合格货；质量异常需隔离。'],
membership: ['信息查看权益', '会员或按条查看的待确认商业规则。', '正式价格另议，999元不是已启用收费。'],
stock: ['共享库存', '区分货权、保管权、预留、损耗和批次。', '正式库存锁定须服务端事务；保管权不等于销售货权。'],
operations: ['冷库运行', '跟踪容量、运行与异常核实。', '电力监测是辅助线索，不直接证明有货或停业。'],
processing: ['加工与分拣', '关联投入、分级、产出与批次流向。', '数量平衡和食品安全分别验收。'],
samples: ['检测委托', '采样登记、封样与流转。', '采样人与审核人分离，保留授权和证据。'],
reports: ['检测报告', '查看报告、建议与核验进度。', '不冒充绿色食品标识或官方认证。'],
stories: ['生产记录', '选择已授权记录，为销售准备内容。', '发布前确认媒体授权，不公开原始GPS与家庭资料。'],
application: ['加入农事中心', '按角色提交合作申请与必要资质。', '草稿仅保存在当前设备，未提交中心审核。']
}
const roleModules = {
farmer: ['plots', 'records', 'costs', 'soil', 'services', 'sales', 'authorization'],
cooperative: ['members', 'plots', 'records', 'services', 'sales', 'stock'],
buyer: ['maturity', 'demands', 'stock', 'membership', 'nfc'],
supplier: ['nfc', 'receipts'], machine: ['nfc', 'services', 'assets'], team: ['nfc', 'services', 'assets'],
protection: ['nfc', 'services', 'protection', 'assets'], warehouse: ['stock', 'operations'],
processor: ['stock', 'processing', 'demands'], lab: ['samples', 'reports'], family: ['records', 'stories', 'authorization'],
consumer: []
}
const accountSpecs = [
['farmer-team', '林春梅', [['farmer', '林春梅种植户', 'grower-lin'], ['team', '赛岐农服队', 'team-saiqi'], ['consumer', '我的农场关注', 'consumer-lin']]],
['cooperative-supplier', '合作社经办人', [['cooperative', '狮子头合作社', 'coop-shizi'], ['supplier', '合作社农资门店', 'supplier-shizi']]],
['buyer', '采购经办人', [['buyer', '采购企业', 'buyer-demo']]],
['machine-protection', '农机植保经办人', [['machine', '赛岐农机服务', 'machine-saiqi'], ['protection', '赛岐植保团队', 'protection-saiqi']]],
['warehouse-processor', '冷库分拣经办人', [['warehouse', '赛岐冷库', 'warehouse-saiqi'], ['processor', '葡萄分拣车间', 'processor-saiqi']]],
['lab', '检测经办人', [['lab', '土壤检测机构', 'lab-demo']]],
['family-farmer', '子女代办人', [['family', '林春梅家庭委托', 'family-lin'], ['farmer', '本人种植地块', 'grower-child']]],
['consumer', '农场访客', [['consumer', '我的农场关注', 'consumer-demo']]]
]
const valueCatalog=require('./value-data')
Object.assign(definitions,valueCatalog.definitions)
Object.keys(roleModules).forEach(role=>{roleModules[role].push(...valueCatalog.views(role).map(id=>'value-'+id))})
const accounts = accountSpecs.map(([id, name, rows]) => ({ id, name, identities: rows.map(([role, org, orgId]) => ({ id: orgId + ':' + role, orgId, org: org + '（示例）', role, label: roleNames[role] })) }))
function modules(role) { return (roleModules[role] || []).map(id => ({ id, title: definitions[id][0], summary: definitions[id][1], caution: definitions[id][2] })) }
function moduleById(role, id) { return modules(role).find(item => item.id === id) || (id === 'application' ? { id, title: definitions[id][0], summary: definitions[id][1], caution: definitions[id][2] } : null) }
function hasCards(role) { return ['farmer', 'family', 'cooperative'].includes(role) }
module.exports = { accounts, roleNames, modules, moduleById, hasCards }
