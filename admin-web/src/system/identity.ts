export const identityTemplates = [
  { id: 'farmer', name: '种植生产', modules: ['地块产季', '农事记录', '成本估算', '申请服务'], rule: '只能访问所属或被授权地块；按键次数不是人天。' },
  { id: 'cooperative', name: '合作社协同', modules: ['社员档案', '授权记录', '服务调度', '供货意向'], rule: '合作社成员与地块授权分别核验。' },
  { id: 'team', name: '农服履约', modules: ['受托工单', '作业留证', '设备队伍', 'NFC关联'], rule: '执行人与验收人独立，角色改名不改变验收规则。' },
  { id: 'machine', name: '农机履约', modules: ['受托工单', '机具资源', '作业留证', 'NFC关联'], rule: '必要的机具和人员资质单独核验。' },
  { id: 'protection', name: '植保履约', modules: ['受托工单', '药剂批次', '安全间隔', '作业留证'], rule: '植保专业字段不能因自定义身份被删去。' },
  { id: 'supplier', name: '农资经营', modules: ['销售凭据', '退货凭据', 'NFC关联'], rule: '农资销售与实际施用分开，不读取完整农户档案。' },
  { id: 'buyer', name: '采购流通', modules: ['成熟货源', '采购需求', '授权信息权益'], rule: '只能查看授权摘要，不公开农户私人成本与GPS。' },
  { id: 'warehouse', name: '仓储服务', modules: ['保管库存', '交接出库', '运行观测'], rule: '保管权不是销售货权，用电不等于库存。' },
  { id: 'processor', name: '加工分拣', modules: ['分级投入产出', '批次追溯', '尾货需求'], rule: '数量平衡与质量验收分别留痕。' },
  { id: 'lab', name: '检测机构', modules: ['受托采样', '检测报告', '农技建议'], rule: '报告提交不等于独立审核通过；必要机构资质须核验。' },
  { id: 'family', name: '授权代办', modules: ['授权记录查看', '代办草稿', '授权生产记录'], rule: '不是自动签约、收款或无限期访问权限。' },
  { id: 'consumer', name: '农场消费', modules: ['公开农场', '认购意向', '跟踪与售后'], rule: '消费身份不开放后台财务、生产私有数据或管理权限。' },
] as const
export type IdentityTemplateId = typeof identityTemplates[number]['id']
export type BusinessIdentityDefinition = { id: string; centerId: string; name: string; industry: string; templateId: IdentityTemplateId; admission: string; status: '基础模板' | '待发布草案' }
export const identityIndustries = ['通用农业', '葡萄产区', '茶叶产区', '粮食产区', '果蔬产区', '其他产区'] as const
const identityNames: Record<IdentityTemplateId, string> = { farmer: '种植户', cooperative: '合作社', team: '农服队', machine: '农机服务', protection: '植保团队', supplier: '农资商', buyer: '采购商', warehouse: '冷库', processor: '加工分拣', lab: '检测机构', family: '子女代办', consumer: '消费者' }
export function initialIdentityDefinitions(centerId: string): BusinessIdentityDefinition[] {
  return identityTemplates.map(t => ({ id: `base-${t.id}`, centerId, name: identityNames[t.id], industry: '通用农业', templateId: t.id, admission: t.rule, status: '基础模板' }))
}
export function validateIdentityDefinition(d: BusinessIdentityDefinition) {
  if (typeof d.id !== 'string' || typeof d.centerId !== 'string' || typeof d.name !== 'string' || d.name.trim().length < 2 || d.name.length > 40 || !identityIndustries.some(i => i === d.industry)
    || !identityTemplates.some(t => t.id === d.templateId) || typeof d.admission !== 'string' || d.admission.trim().length < 8 || d.admission.length > 300 || !['基础模板', '待发布草案'].includes(d.status)) throw new Error('请填写有效的产区身份、业务模板和准入说明')
  if (/1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(d.name + d.admission)) throw new Error('目录草案不要包含真实个人联系方式')
}
