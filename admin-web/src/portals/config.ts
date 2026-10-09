const baseRoles = [
  { id: 'farmer', name: '种植户', actor: '林春梅', icon: 'sprout', group: '生产与协同', headline: '安心种好地，记录有人帮。', description: '自己的地块、农事卡、成本与销售意向，一处看清。', scope: '林春梅本人名下地块与记录', modules: ['plots', 'records', 'cards', 'costs', 'services', 'sales', 'soil', 'authorization'] },
  { id: 'cooperative', name: '合作社', actor: '赛岐农服合作社（演示）', icon: 'users', group: '生产与协同', headline: '把小农户连接成一条产业带。', description: '协同社员建档、农事采集、服务调度与产销对接。', scope: '已授权社员：林春梅、陈建国、叶秋香', modules: ['plots', 'records', 'cards', 'services', 'sales', 'stock'] },
  { id: 'buyer', name: '采购商', actor: '宁德鲜果采购（演示）', icon: 'basket', group: '产销与流通', headline: '好货在哪里，什么时候成熟。', description: '从成熟日历找货，从采购意向建立产地联系。', scope: '公开货源与本主体的采购意向，不含农户成本和原始定位', modules: ['maturity', 'demands', 'stock', 'membership'] },
  { id: 'supplier', name: '农资商', actor: '乡桥农资合作门店（演示）', icon: 'store', group: '服务与履约', headline: '每一笔农资，都有据可查。', description: '模拟NFC识别、登记农资批次，给生产记录补上来源。', scope: '本门店销售凭据；刷卡不等于获得农户全部档案', modules: ['nfc', 'receipts'] },
  { id: 'machine', name: '农机手', actor: '赛岐农机服务站（演示）', icon: 'tractor', group: '服务与履约', headline: '把设备和时间，用在需要的地方。', description: '查看指派订单、更新作业进度、管理农机可服务状态。', scope: '指派给本服务站的订单及自有设备', modules: ['services', 'assets'] },
  { id: 'team', name: '农服队', actor: '狮子头农服队（演示）', icon: 'tools', group: '服务与履约', headline: '从接单到验收，每一步都有回响。', description: '组织队伍、执行农事服务，完成后由委托方确认。', scope: '指派给本队伍的服务订单及人员资源', modules: ['services', 'assets'] },
  { id: 'protection', name: '植保团队', actor: '赛岐专业植保队（演示）', icon: 'shield', group: '服务与履约', headline: '每一次植保，都留下完整依据。', description: '共用服务履约流程，单独记录药剂批次、施用量和安全间隔。', scope: '本植保队受托订单、作业档案及自有资源', modules: ['services', 'protection', 'assets'] },
  { id: 'warehouse', name: '冷库', actor: '赛岐1号冷库', icon: 'warehouse', group: '产销与流通', headline: '看清库存，也看清每一次流转。', description: '按库位核对库存与锁定订单，管理交接与运营情况。', scope: '赛岐1号冷库保管批次；不代表拥有货权', modules: ['stock', 'operations'] },
  { id: 'processor', name: '加工分拣', actor: '狮子头分拣车间（演示）', icon: 'package', group: '产销与流通', headline: '分级有账，尾货有去处。', description: '登记分拣投入与产出，发布B级货采购需求。', scope: '本车间货权批次与本主体采购意向', modules: ['stock', 'processing', 'demands'] },
  { id: 'lab', name: '检测机构', actor: '合作检测机构（演示）', icon: 'flask', group: '专业支持', headline: '从一份土样，到有依据的建议。', description: '受托采样、记录检测结果、提交报告待运营核验。', scope: '委托给本机构的样品和报告，不自行核验认证', modules: ['samples', 'reports'] },
  { id: 'family', name: '子女代办', actor: '林晓', icon: 'heart', group: '专业支持', headline: '家里的收成，远方也能关心。', description: '在授权范围内帮助父母看记录、设置农事卡、整理产季记录。', scope: '林春梅授权范围；本演示会话内撤销后停止代办访问', modules: ['records', 'cards', 'stories', 'authorization'] },
] as const
const valueRoleModules = {
  farmer: ['value-passport', 'value-calendar', 'value-stories', 'value-income', 'value-grades', 'value-history', 'value-collaboration', 'value-feedback'],
  cooperative: ['value-passport', 'value-calendar', 'value-stories', 'value-income', 'value-grades', 'value-history', 'value-collaboration', 'value-feedback'],
  buyer: ['value-passport', 'value-calendar', 'value-grades', 'value-feedback'],
  supplier: ['value-collaboration'], machine: ['value-collaboration'], team: ['value-collaboration'], protection: ['value-collaboration'],
  warehouse: ['value-passport', 'value-grades'], processor: ['value-passport', 'value-calendar', 'value-grades', 'value-feedback'],
  lab: ['value-collaboration'], family: ['value-passport', 'value-stories', 'value-history'],
} as const
export const roles = baseRoles.map(role => ({ ...role, modules: [...role.modules, ...valueRoleModules[role.id]] }))
export type RoleId = typeof roles[number]['id']
export type Role = typeof roles[number]
export type ModuleId = typeof roles[number]['modules'][number]
export const moduleLabels: Record<ModuleId, string> = {
  'value-passport': '产品批次履历', 'value-calendar': '采收供货日历', 'value-stories': '产季记录', 'value-income': '经营净收益', 'value-grades': '分级货源匹配', 'value-history': '跨年经营对比', 'value-collaboration': '协同与缺项提醒', 'value-feedback': '履约反馈',
  plots: '地块与产季', records: '农事记录', cards: '我的农事卡', costs: '成本与定价', services: '农事服务', sales: '供货意向', soil: '肥力与建议', authorization: '家庭授权', maturity: '成熟货源', demands: '采购需求', stock: '库存与订单', membership: '会员与查看', nfc: 'NFC销售登记', receipts: '农资销售凭据', assets: '服务资源', operations: '冷库运营', processing: '分拣批次', samples: '受托样品', reports: '检测报告', stories: '产季记录草稿', protection: '植保作业档案',
}
export const getRole = (id?: string) => roles.find(r => r.id === id)
export const rolePath = (role: RoleId, module?: ModuleId) => `/workspace/${role}${module ? `/${module}` : ''}`
export const hasModule = (role: Role, module: string): module is ModuleId => (role.modules as readonly string[]).includes(module)
export const memberNames = ['林春梅', '陈建国', '叶秋香']
