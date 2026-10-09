/** Navigation is presentation, not an authorization grant or a second data store. */
export const adminCenters = [
  { id: 'overview', name: '运营工作台', description: '统一看待办、异常与经营概况；业务审批仍按对象和岗位分别处理。', tabs: [{ id: 'dashboard', label: '总览与待办' }] },
  { id: 'subjects', name: '组织与主体', description: '公司、服务中心、成员和产区身份共用目录；业务身份与管理员岗位分开授权。', tabs: [{ id: 'members', label: '成员与经营主体' }, { id: 'centers', label: '公司与服务中心' }, { id: 'identities', label: '产区身份目录' }] },
  { id: 'production', name: '生产与记录', description: '围绕地块和产季整理记录、卡片、肥力与经营依据；公开授权另行审核。', tabs: [{ id: 'plots', label: '地块登记核验' }, { id: 'seasons', label: '地块与产季' }, { id: 'records', label: '农事记录' }, { id: 'season-records', label: '产季记录' }, { id: 'cards', label: '农事卡' }, { id: 'soil', label: '肥力与建议' }, { id: 'economics', label: '成本与经营' }, { id: 'history', label: '历年对比' }] },
  { id: 'services', name: '农事服务', description: '按委托、调度、作业、完工与独立验收衔接；资源运行信号不等于可接单。', tabs: [{ id: 'orders', label: '服务调度与履约' }, { id: 'resources', label: '资源目录与运行' }] },
  { id: 'trade', name: '产品与交易', description: '以批次连接成熟供货、分级库存、购销和认购；预测、货权与资金状态不混同。', tabs: [{ id: 'supply', label: '成熟与供货' }, { id: 'inventory', label: '库存与分级货源' }, { id: 'procurement', label: '自营收购与销售' }, { id: 'passport', label: '产品批次履历' }, { id: 'farms', label: '农场运营筹备' }, { id: 'membership', label: '商家服务与采购权益' }] },
  { id: 'quality', name: '核验与追溯', description: '核验范围、证据版本、执行标准与外部回执分别留痕，不替代官方质量认证。', tabs: [{ id: 'verification', label: '记录核验体系' }, { id: 'trace', label: '追溯与报送' }] },
  { id: 'customer', name: '客户与内容', description: '统一帮助受理和内容管理；客服不能自行改农事事实、库存或资金账。', tabs: [{ id: 'support', label: '帮助与履约反馈' }, { id: 'news', label: '新闻与公告' }, { id: 'social', label: '社交账号与展示' }] },
  { id: 'finance', name: '财务与结算', description: '支付商户、分账和对账独立于商家权益；只向获授权财务岗位开放。', tabs: [{ id: 'settlement', label: '商户、分账与对账' }] },
  { id: 'platform', name: '平台与安全', description: '管理岗位、基础参数、审计和数据交换；合并入口不合并审批责任。', tabs: [{ id: 'permissions', label: '权限与提权审批' }, { id: 'logs', label: '日志与审计' }, { id: 'integrations', label: '外部平台接入' }, { id: 'api', label: '开放应用管理' }, { id: 'config', label: '业务参数' }, { id: 'dictionaries', label: '行政区划与字典' }] },
] as const
export type CenterId = typeof adminCenters[number]['id']
export function centerPath(id: CenterId, section?: string) {
  const center = adminCenters.find(c => c.id === id)!
  return id === 'overview' ? '/' : `/manage/${id}/${section || center.tabs[0].id}`
}
const legacy: Record<string, string> = {
  '/members': centerPath('subjects'), '/plots': centerPath('production'), '/production': centerPath('production', 'seasons'),
  '/cards': centerPath('production', 'cards'), '/records': centerPath('production', 'records'), '/soil': centerPath('production', 'soil'), '/costs': centerPath('production', 'economics'),
  '/services': centerPath('services'), '/services/help-center': centerPath('customer'),
  '/supply': centerPath('trade'), '/maturity': `${centerPath('trade')}?view=map`, '/inventory': centerPath('trade', 'inventory'), '/procurement': centerPath('trade', 'procurement'), '/merchants': centerPath('trade', 'membership'), '/cloud-farms': centerPath('trade', 'farms'),
  '/resources': centerPath('services', 'resources'), '/verification': centerPath('quality'), '/trace': centerPath('quality', 'trace'),
  '/settings/centers': centerPath('subjects', 'centers'), '/settings/identities': centerPath('subjects', 'identities'),
  '/settings/news': centerPath('customer', 'news'), '/settings/social': centerPath('customer', 'social'),
  '/settings/permissions': centerPath('platform'), '/audit': centerPath('platform'), '/settings/logs': centerPath('platform', 'logs'), '/settings/integrations': centerPath('platform', 'integrations'),
  '/config': centerPath('platform', 'config'), '/settings': centerPath('platform', 'dictionaries'), '/open-api': centerPath('platform', 'api'),
  '/production/value/passport': centerPath('trade', 'passport'), '/production/value/calendar': `${centerPath('trade')}?view=calendar`,
  '/production/value/stories': centerPath('production', 'season-records'), '/production/value/income': `${centerPath('production', 'economics')}?view=income`,
  '/production/value/grades': `${centerPath('trade', 'inventory')}?view=grades`, '/production/value/history': centerPath('production', 'history'),
  '/production/value/collaboration': '/?view=followup', '/production/value/feedback': centerPath('customer'),
}
export function legacyAdminPath(path: string) {
  if (legacy[path]) return legacy[path]
  for (const [prefix, target] of [['/members/', '/manage/subjects/members/'], ['/plots/', '/manage/production/plots/'], ['/services/', '/manage/services/orders/'], ['/tasks/', '/manage/overview/tasks/']]) {
    if (path.startsWith(prefix)) return target + path.slice(prefix.length)
  }
  return null
}
export function mergeLegacyLocation(path: string, search: string, hash: string) {
  const target = legacyAdminPath(path)
  if (!target) return null
  const [pathname, defaults = ''] = target.split('?')
  const query = new URLSearchParams(search)
  for (const [key, value] of new URLSearchParams(defaults)) if (!query.has(key)) query.set(key, value)
  return pathname + (query.size ? `?${query}` : '') + hash
}
