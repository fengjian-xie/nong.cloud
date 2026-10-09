export const memberGroups = ['平台与农资', '种植与农服', '技术与无人机', '检测与配套'] as const
// Public professional fields only; blank cells are not inferred from adjacent rows.
export const members = [
  { group: 0, name: '谢逢建', organization: '乡桥农业有限公司', service: '平台搭建、数据管理', area: '宁德全域' },
  { group: 0, name: '王泽强', organization: '主体待补充', service: '农资销售', area: '福安全域' },
  { group: 1, name: '缪贵雄', organization: '福安市果多多种植合作社', service: '葡萄种植、农服队、数据采集', area: '福安市湾坞镇' },
  { group: 1, name: '郑凯峰', organization: '主体待补充', service: '葡萄种植、农服队、数据采集', area: '福安市松罗乡' },
  { group: 1, name: '谢万柳', organization: '主体待补充', service: '葡萄种植、农服队、数据采集', area: '福安市晓阳镇' },
  { group: 2, name: '张富民', organization: '科特派（资料标注，待核验）', service: '葡萄种植技术顾问', area: '宁德全域' },
  { group: 2, name: '陈荣华', organization: '科特派（资料标注，待核验）', service: '葡萄种植技术顾问', area: '宁德全域' },
  { group: 2, name: '倪程鹏', organization: '主体待补充', service: '无人机手', area: '福安全域' },
  { group: 2, name: '林（姓名待补充）', organization: '主体待补充', service: '无人机调度长', area: '宁德全域' },
  { group: 3, name: '负责人待补充', organization: '主体待补充', service: '土壤检测', area: '福建全省' },
  { group: 3, name: '负责人待补充', organization: '主体待补充', service: '福安巨峰葡萄分拣、包装', area: '宁德全域' },
  { group: 3, name: '负责人待补充', organization: '植保公司（完整名称待补充）', service: '植保', area: '宁德全域' },
] as const

export const applicationRoles = [
  { id: 'grower', label: '种植户', standards: ['grower'] },
  { id: 'cooperative', label: '合作社', standards: ['cooperative'] },
  { id: 'inputs', label: '农资商', standards: ['inputs'] },
  { id: 'machine', label: '农机手', standards: ['machine'] },
  { id: 'service', label: '农服队', standards: ['service'] },
  { id: 'protection', label: '植保与无人机', standards: ['protection', 'drone'] },
  { id: 'laboratory', label: '检测机构', standards: ['laboratory'] },
  { id: 'trade', label: '采购与流通', standards: ['buyer', 'processing', 'logistics'] },
] as const

export const cardFeatures = [
  ['按键记录', '开工、收工与A/B/C作业键，按一次留一条记录。'],
  ['GPS识别地块', '与测绘地块匹配；定位不准时由代办人员确认。'],
  ['离线储存，蓝牙同步', '没网络也能记录，连接手机后再上传。'],
  ['NFC衔接服务', '农资、农机、农服与收购环节按授权关联记录。'],
] as const
export const cardScenarios = [
  { name: '田间作业', steps: ['按键开工', '选择作业', '按键收工', '代办同步'], description: '作业键记录时间与位置，合作社或子女补全农资用量等信息；卡片本身不自动判断作业质量。' },
  { name: '农资采购', steps: ['授权刷卡', '关联地块', '确认农资', '凭证归档'], description: '农资商关联商品、批号、数量和购买凭证；购买不等于实际施用，施用量由作业记录另行确认。' },
  { name: '农机农服', steps: ['确认委托', '关联作业', '交付验收', '同步记录'], description: '农机手、农服与植保队按授权关联服务订单，由委托方核对作业范围、投入品和完成情况；刷卡不自动扣款。' },
  { name: '收购销售', steps: ['关联批次', '分级过磅', '确认交付', '溯源跟踪'], description: '采购商按授权查看批次摘要，核对等级、重量与结算约定；完整个人信息及成本明细不默认向买方公开。' },
] as const
