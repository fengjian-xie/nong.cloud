import { initialNews, isNewsArticle, newsCategories, type NewsArticle } from '../content/news'
import { emptySocialAccounts, validateSocialAccount, type SocialAccount } from '../content/social'
import { initialIdentityDefinitions, validateIdentityDefinition, type BusinessIdentityDefinition } from './identity'

export const permissionCatalog = [
  { id: 'records.read', name: '查看农事记录', group: '业务运营' }, { id: 'records.review', name: '核验农事记录', group: '业务运营' },
  { id: 'services.manage', name: '服务调度', group: '业务运营' }, { id: 'support.read', name: '查看帮助工单', group: '帮助中心' },
  { id: 'support.handle', name: '受理与分派', group: '帮助中心' }, { id: 'logs.read', name: '查看日志', group: '系统管理' },
  { id: 'logs.export', name: '导出演示日志', group: '系统管理' }, { id: 'integrations.read', name: '查看第三方接口', group: '系统管理' },
  { id: 'integrations.manage', name: '管理接口配置', group: '系统管理' }, { id: 'admins.read', name: '查看管理员', group: '系统管理' },
  { id: 'admins.manage', name: '申请与审批权限变更', group: '系统管理' }, { id: 'news.read', name: '查看新闻', group: '内容管理' },
  { id: 'news.edit', name: '编辑与提交新闻', group: '内容管理' }, { id: 'news.review', name: '审核与下架新闻', group: '内容管理' },
  { id: 'merchants.read', name: '查看商户信息', group: '财务管理' }, { id: 'sharing.configure', name: '分账规则管理', group: '财务管理' },
  { id: 'socials.read', name: '查看社交账号', group: '内容管理' }, { id: 'socials.manage', name: '配置中心社交账号', group: '内容管理' },
  { id: 'centers.read', name: '查看组织目录', group: '组织协同' }, { id: 'centers.apply', name: '提交中心筹备申请', group: '组织协同' },
  { id: 'centers.manage', name: '平台组织审核与维护', group: '平台管理' },
  { id: 'identities.read', name: '查看产区身份目录', group: '组织协同' }, { id: 'identities.manage', name: '维护产区身份草案', group: '组织协同' },
] as const
export type PermissionId = typeof permissionCatalog[number]['id']
export const permissionGroups = [...new Set(permissionCatalog.map(p => p.group))]
export const centerScopes = [{ id: 'fuan', name: '福安市中心' }, { id: 'saiqi', name: '赛岐服务站' }, { id: 'xibing', name: '溪柄服务站' }] as const
export type ScopeId = typeof centerScopes[number]['id']
export const roleTemplates: { id: string; name: string; permissions: PermissionId[] }[] = [
  { id: 'county', name: '县域运营管理员', permissions: permissionCatalog.filter(p => p.group !== '财务管理' && p.group !== '平台管理').map(p => p.id) },
  { id: 'system', name: '平台系统管理员', permissions: permissionCatalog.map(p => p.id) },
  { id: 'support', name: '客服坐席', permissions: ['support.read', 'support.handle', 'logs.read'] },
  { id: 'auditor', name: '只读审计员', permissions: ['records.read', 'logs.read', 'logs.export', 'admins.read', 'integrations.read', 'news.read', 'socials.read', 'centers.read'] },
  { id: 'integration', name: '接口管理员', permissions: ['integrations.read', 'integrations.manage', 'logs.read'] },
  { id: 'editor', name: '新闻编辑员', permissions: ['news.read', 'news.edit', 'logs.read'] },
  { id: 'finance', name: '财务管理员', permissions: ['merchants.read', 'sharing.configure', 'logs.read'] },
]
export type SystemActor = { accountId: string; name: string; tenant: string; scope: ScopeId; permissions: PermissionId[] }
export type Administrator = { id: string; accountId: string; name: string; roleId: string; scope: ScopeId; status: '启用' | '停用'; permissions: PermissionId[]; revision: number }
export type PermissionRequest = { id: string; targetId: string; requesterId: string; roleId: string; scope: ScopeId; permissions: PermissionId[]; status: '待审批' | '演示已通过'; targetRevision: number; reason: string }
export const logCategories = ['操作审计', '接口接入', '安全告警', '系统运行'] as const
export const logLevels = ['信息', '警告', '错误'] as const
export type AuditEntry = { id: string; at: string; category: typeof logCategories[number]; level: typeof logLevels[number]; actor: string; action: string; target: string; result: string; traceId: string; detail: string }
export type Integration = { id: string; name: string; category: string; description: string; dataScope: string; owner: string; endpoint: string; authorization: string; status: '未配置' | '本地已配置' | '本地已停用' }
export const organizationKinds = ['平台主体', '独立公司运营中心', '分公司运营中心', '合作运营中心', '乡镇服务站'] as const
export type Organization = { id: string; parentId: string | null; name: string; company: string; kind: typeof organizationKinds[number]; region: string; status: '目录示例' | '试点规划' | '待平台审核' | '演示已启用'; applicantId: string }
export type SystemState = { version: 2; tenant: string; accountId: string; logs: AuditEntry[]; integrations: Integration[]; administrators: Administrator[]; requests: PermissionRequest[]; news: NewsArticle[]; organizations: Organization[]; socials: SocialAccount[]; identities: BusinessIdentityDefinition[] }

export function systemStorageKey(tenant: string, accountId: string) { return `xiangqiao:admin-systems-demo:v2:${encodeURIComponent(tenant)}:${encodeURIComponent(accountId)}` }
export function makeActor(user: { id: string; name: string; role: string }): SystemActor {
  const role = roleTemplates.find(r => r.name === user.role)
  return { accountId: user.id, name: `${user.name}（演示）`, tenant: 'fuan', scope: 'fuan', permissions: role ? [...role.permissions] : [] }
}
function localId(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}` }
function requirePermission(actor: SystemActor, permission: PermissionId) {
  if (!actor.permissions.includes(permission)) throw new Error('当前演示岗位没有此操作权限')
}
function checkText(text: string, min: number, max: number) {
  if (text.trim().length < min || text.length > max) throw new Error(`请填写${min}–${max}字的演示内容`)
  if (/1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|BEGIN[\s\S]*PRIVATE KEY|(?:api[_-]?key|access[_-]?token|secret)\s*[:=]/i.test(text)) throw new Error('演示内容不要包含真实联系方式、密钥或令牌')
}
export function validateEndpoint(value: string) {
  if (!value) return
  let url: URL
  try { url = new URL(value) } catch { throw new Error('请填写不含凭据的HTTPS接口地址') }
  if (value.length > 300 || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+\.[a-z]{2,}$/i.test(url.hostname) && !/^[a-z0-9-]+\.[a-z]{2,}$/i.test(url.hostname)
    || /(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname)) throw new Error('只接受公网域名HTTPS地址；不包含IP、内网地址、凭据、查询参数或片段')
}
export function assertPermissionSet(permissions: PermissionId[]) {
  if (!permissions.length || new Set(permissions).size !== permissions.length || permissions.some(id => !permissionCatalog.some(p => p.id === id))) throw new Error('请选择有效且不重复的权限')
  for (const [action, read] of [['logs.export', 'logs.read'], ['integrations.manage', 'integrations.read'], ['admins.manage', 'admins.read'], ['news.edit', 'news.read'], ['news.review', 'news.read'], ['support.handle', 'support.read'], ['records.review', 'records.read'], ['socials.manage', 'socials.read'], ['centers.manage', 'centers.read'], ['centers.apply', 'centers.read']] as [PermissionId, PermissionId][]) {
    if (permissions.includes(action) && !permissions.includes(read)) throw new Error('操作权限需同时包含对应查看权限')
  }
}
function checkScope(actor: SystemActor, scope: ScopeId) {
  if (!centerScopes.some(s => s.id === scope) || actor.scope !== 'fuan' && actor.scope !== scope) throw new Error('不能超出当前服务中心范围授权')
}

export function createSystemState(actor: SystemActor): SystemState {
  const role = (id: string) => [...roleTemplates.find(r => r.id === id)!.permissions]
  return { version: 2, tenant: actor.tenant, accountId: actor.accountId, news: structuredClone(initialNews), identities: initialIdentityDefinitions(actor.tenant),
    organizations: [
      { id: 'platform', parentId: null, name: '乡桥平台总公司', company: '乡桥农业有限公司', kind: '平台主体', region: '跨区域平台', status: '目录示例', applicantId: 'platform-owner-demo' },
      { id: 'fuan', parentId: 'platform', name: '福安市农事综合服务中心', company: '福安市乡桥农事综合服务有限公司', kind: '独立公司运营中心', region: '福建省宁德市福安市赛岐镇狮子头村', status: '试点规划', applicantId: 'fuan-planning-demo' },
      { id: 'saiqi', parentId: 'fuan', name: '赛岐服务站（架构示例）', company: '福安中心下设服务站（示例）', kind: '乡镇服务站', region: '福安市赛岐镇', status: '目录示例', applicantId: 'fuan-planning-demo' },
      { id: 'xibing', parentId: 'fuan', name: '溪柄服务站（架构示例）', company: '福安中心下设服务站（示例）', kind: '乡镇服务站', region: '福安市溪柄镇', status: '目录示例', applicantId: 'fuan-planning-demo' },
    ], socials: ['platform', 'fuan', 'saiqi', 'xibing'].flatMap(emptySocialAccounts),
    administrators: [
      { id: 'admin-current', accountId: actor.accountId, name: actor.name, roleId: 'county', scope: 'fuan', status: '启用', permissions: [...actor.permissions], revision: 1 },
      { id: 'admin-support', accountId: 'support-demo', name: '林客服（示例）', roleId: 'support', scope: 'saiqi', status: '启用', permissions: ['support.read', 'logs.read'], revision: 1 },
      { id: 'admin-editor', accountId: 'content-editor-demo', name: '内容编辑员（示例）', roleId: 'editor', scope: 'fuan', status: '启用', permissions: role('editor'), revision: 1 },
      { id: 'admin-finance', accountId: 'finance-demo', name: '财务经办人（示例）', roleId: 'finance', scope: 'fuan', status: '启用', permissions: role('finance'), revision: 1 },
    ],
    requests: [{ id: 'permission-example', targetId: 'admin-support', requesterId: 'support-supervisor-demo', roleId: 'support', scope: 'saiqi', permissions: role('support'), status: '待审批', targetRevision: 1, reason: '示例申请：客服增加受理分派能力，待其他管理员审核。' }],
    integrations: [
      { id: 'trace', name: '一品一码 / 追溯平台', category: '政务追溯', description: '按授权映射地块、生产记录和产品批次，预检后报送。', dataScope: '仅经授权的生产、检测与批次字段；保留平台回执。', owner: '运营与追溯经办', endpoint: '', authorization: '机构授权（待接入）', status: '未配置' },
      { id: 'wechat', name: '微信小程序与支付服务商', category: '账号与支付', description: '小程序AppID：wx8e467f0ee6022a34。商户与分账仅在管理后台。', dataScope: '真实登录、支付签名、证书、分账及退款必须由服务端处理。', owner: '平台技术 / 财务', endpoint: '', authorization: '服务端凭据托管（待接入）', status: '未配置' },
      { id: 'camera', name: '摄像头与云视频', category: '农场设备', description: '关联地块镜头与授权观看范围，不公开摄像头管理凭据。', dataScope: '短效播放授权、设备状态；不以资料照片冒充直播。', owner: '农场设备经办', endpoint: '', authorization: '服务端凭据托管（待接入）', status: '未配置' },
      { id: 'soil', name: '土壤检测机构', category: '检测与农技', description: '接收机构报告与建议施肥方案，保留样本及报告来源。', dataScope: '采样编号、地块、指标、报告版本与机构资质证据。', owner: '检测机构经办', endpoint: '', authorization: '机构授权（待接入）', status: '未配置' },
      { id: 'map', name: '地图与地块测绘', category: '基础服务', description: '地块边界、面积、位置和海拔来源分别记录。', dataScope: '坐标系与测量精度；授权范围之外不展示精确位置。', owner: '地块管理经办', endpoint: '', authorization: '服务端凭据托管（待接入）', status: '未配置' },
      { id: 'environment', name: '环境传感器与用电数据', category: '农场设备', description: '环境和运营观测分开管理；用电数据不等同实际库存或产能。', dataScope: '传感器时间、设备健康度、经主体授权的用电数据。', owner: '设备与资源经办', endpoint: '', authorization: '机构授权（待接入）', status: '未配置' },
    ],
    logs: [
      { id: 'log-start', at: '2026-10-06T01:00:00Z', category: '系统运行', level: '信息', actor: '系统（虚构）', action: '载入演示配置', target: '福安市中心', result: '示例', traceId: 'demo-start', detail: '这不是服务器运行日志。所有页面数据仅用于本机演示。' },
      { id: 'log-api', at: '2026-10-06T01:10:00Z', category: '接口接入', level: '警告', actor: '接口经办（虚构）', action: '追溯报送待接入', target: '一品一码', result: '未执行', traceId: 'demo-trace', detail: '没有发送HTTP请求；真实接口规范、授权和回执处理待接入。' },
      { id: 'log-permission', at: '2026-10-06T01:20:00Z', category: '安全告警', level: '警告', actor: '管理员（虚构）', action: '自身提权被阻止', target: '当前账号', result: '拒绝（示例）', traceId: 'demo-denied', detail: '示例规则：同账号不得自行调整权限或审批自己的权限申请。前端规则不等于生产RBAC。' },
    ],
  }
}

export type SystemAction =
  | { type: 'integration.save'; id: string; endpoint: string; owner: string; authorization: string }
  | { type: 'integration.check'; id: string }
  | { type: 'integration.queue'; id: string }
  | { type: 'integration.pause'; id: string }
  | { type: 'permission.request'; targetId: string; roleId: string; scope: ScopeId; permissions: PermissionId[]; reason: string }
  | { type: 'permission.approve'; id: string }
  | { type: 'news.save'; article: NewsArticle }
  | { type: 'news.submit' | 'news.approve' | 'news.withdraw' | 'news.unpublish'; id: string }
  | { type: 'logs.export'; count: number }
  | { type: 'social.save'; account: SocialAccount }
  | { type: 'center.request'; name: string; company: string; kind: Organization['kind']; region: string }
  | { type: 'center.approve'; id: string }
  | { type: 'identity.save'; definition: BusinessIdentityDefinition }
  | { type: 'identity.export'; count: number }

export function applySystemAction(state: SystemState, action: SystemAction, actor: SystemActor): SystemState {
  if (state.tenant !== actor.tenant || state.accountId !== actor.accountId) throw new Error('当前账号或服务中心已改变，请重新打开页面')
  const next = structuredClone(state)
  let category: AuditEntry['category'] = '操作审计', title = '', target = '', result = '成功（本地）', detail = ''
  const level: AuditEntry['level'] = '信息'
  if (action.type.startsWith('integration.')) {
    requirePermission(actor, 'integrations.manage')
    const a = action as Extract<SystemAction, { id: string }> & { endpoint?: string; owner?: string; authorization?: string }
    const item = next.integrations.find(i => i.id === a.id)
    if (!item) throw new Error('接口不存在')
    category = '接口接入'; target = item.name
    if (action.type === 'integration.save') {
      validateEndpoint(action.endpoint); checkText(action.owner, 2, 50)
      if (!['机构授权（待接入）', '服务端凭据托管（待接入）'].includes(action.authorization)) throw new Error('授权类型无效')
      Object.assign(item, { endpoint: action.endpoint.trim(), owner: action.owner.trim(), authorization: action.authorization, status: '本地已配置' })
      title = '保存接口演示配置'; detail = '只保存公网地址、负责人和授权方式；不存储密钥，不更改真实接口。'
    } else if (action.type === 'integration.pause') {
      item.status = '本地已停用'; title = '停用本地接口配置'; detail = '仅更改演示状态，不停止真实业务。'
    } else {
      if (item.status !== '本地已配置' || !item.endpoint) throw new Error('先保存含接口地址的本地配置')
      validateEndpoint(item.endpoint)
      title = action.type === 'integration.check' ? '本地格式检查通过' : '登记演示同步任务'
      result = '未执行'; detail = '未发起连接或上传，没有第三方成功回执；服务端接入待完成。'
    }
  } else if (action.type === 'permission.request') {
    requirePermission(actor, 'admins.manage')
    const admin = next.administrators.find(a => a.id === action.targetId)
    if (!admin || admin.accountId === actor.accountId) throw new Error('不能自行调整当前账号权限')
    checkScope(actor, admin.scope); checkScope(actor, action.scope); checkText(action.reason, 8, 240); assertPermissionSet(action.permissions)
    if (!roleTemplates.some(r => r.id === action.roleId) || action.permissions.some(p => !actor.permissions.includes(p))) throw new Error('不能授予超出自身授权能力的权限')
    if (next.requests.some(r => r.targetId === admin.id && r.status === '待审批')) throw new Error('此管理员已有待审批申请，请先处理')
    next.requests.unshift({ id: localId('permission'), targetId: admin.id, requesterId: actor.accountId, roleId: action.roleId, scope: action.scope, permissions: [...action.permissions], reason: action.reason.trim(), targetRevision: admin.revision, status: '待审批' })
    title = '提交权限变更申请'; target = admin.name; result = '待审核（本地）'; detail = '原权限尚未改变；须由不同账号、具有相应授权能力的管理员审批。'
  } else if (action.type === 'permission.approve') {
    requirePermission(actor, 'admins.manage')
    const request = next.requests.find(r => r.id === action.id)
    const admin = next.administrators.find(a => a.id === request?.targetId)
    if (!request || !admin || request.status !== '待审批') throw new Error('申请不存在或已处理')
    if (request.requesterId === actor.accountId || admin.accountId === actor.accountId) throw new Error('不能审批本人申请或修改自己的权限')
    if (admin.revision !== request.targetRevision) throw new Error('管理员权限版本已改变，请重新申请')
    checkScope(actor, admin.scope); checkScope(actor, request.scope); assertPermissionSet(request.permissions)
    if (request.permissions.some(p => !actor.permissions.includes(p))) throw new Error('当前账号无权审批这些权限')
    Object.assign(admin, { roleId: request.roleId, scope: request.scope, permissions: [...request.permissions], revision: admin.revision + 1 })
    request.status = '演示已通过'; title = '审核权限演示申请'; target = admin.name; detail = '仅更新本机示例管理员资料；未修改真实账号、会话或服务端鉴权。'
  } else if (action.type === 'news.save') {
    requirePermission(actor, 'news.edit')
    const article = action.article
    if (!isNewsArticle(article) || !newsCategories.includes(article.category)) throw new Error('新闻格式无效')
    checkText(article.title, 4, 80); checkText(article.summary, 8, 240); checkText(article.body, 20, 6000)
    const current = next.news.find(a => a.id === article.id)
    if (current && current.status !== '草稿' && current.status !== '已下架') throw new Error('待审核或已发布新闻不能直接修改，请先撤回或下架')
    if (current && article.revision !== current.revision) throw new Error('新闻版本已改变，请重新打开稿件')
    const saved: NewsArticle = { ...article, status: '草稿', authorId: actor.accountId, author: actor.name, revision: (current?.revision ?? 0) + 1,
      contributors: [...new Set([...(current?.contributors ?? (current ? [current.authorId] : [])), actor.accountId])] }
    next.news = current ? next.news.map(a => a.id === saved.id ? saved : a) : [saved, ...next.news]
    title = '保存新闻草稿'; target = saved.title; detail = '草稿只在本机管理端，不进入公开新闻列表。'
  } else if (action.type.startsWith('news.')) {
    const a = action as Extract<SystemAction, { id: string }>
    const article = next.news.find(n => n.id === a.id)
    if (!article) throw new Error('新闻不存在')
    target = article.title
    if (action.type === 'news.submit' || action.type === 'news.withdraw') {
      requirePermission(actor, 'news.edit')
      if (article.authorId !== actor.accountId) throw new Error('只能提交或撤回当前账号编辑的新闻')
      const expected = action.type === 'news.submit' ? '草稿' : '待审核'
      if (article.status !== expected) throw new Error('新闻状态已改变')
      article.status = action.type === 'news.submit' ? '待审核' : '草稿'
      title = action.type === 'news.submit' ? '提交新闻审核' : '撤回新闻审核'
      detail = '未发布至线上官网；提交与审批使用独立账号。'
    } else {
      requirePermission(actor, 'news.review')
      if (action.type === 'news.approve') {
        if (article.status !== '待审核' || article.authorId === actor.accountId || article.contributors?.includes(actor.accountId)) throw new Error('不能审核自己参与编辑的新闻或重复发布')
        article.status = '演示已发布'; title = '审核新闻演示发布'
      } else {
        if (article.status !== '演示已发布') throw new Error('只能下架演示已发布新闻')
        article.status = '已下架'; title = '下架演示新闻'
      }
      detail = '只改变本机公开预览，不会跨域同步或改变nong.cloud线上内容。'
    }
    article.revision += 1
  } else if (action.type === 'social.save') {
    requirePermission(actor, 'socials.manage')
    const account = action.account
    validateSocialAccount(account)
    const organization = next.organizations.find(o => o.id === account.centerId)
    if (!organization || organization.status === '待平台审核') throw new Error('筹备中的中心不能启用社交账号')
    const platformManager = actor.permissions.includes('centers.manage')
    if (!platformManager && (account.centerId === 'platform' || actor.scope !== 'fuan' && actor.scope !== account.centerId || !['fuan', 'saiqi', 'xibing'].includes(account.centerId))) throw new Error('不能修改平台或其他服务中心的社交账号')
    next.socials = next.socials.map(a => a.centerId === account.centerId && a.id === account.id ? { ...account, accountName: account.accountName.trim(), href: account.href.trim() } : a)
    title = '保存中心社交账号配置'; target = organization.name; detail = '仅影响该中心的本机页脚预览；不改变其他中心、平台总入口或线上官方账号。'
  } else if (action.type === 'center.request') {
    requirePermission(actor, 'centers.apply')
    checkText(action.name, 4, 80); checkText(action.company, 4, 100); checkText(action.region, 4, 100)
    if (!['独立公司运营中心', '分公司运营中心', '合作运营中心'].includes(action.kind)) throw new Error('请选择区县服务中心的运营主体类型')
    if (next.organizations.some(o => o.name === action.name.trim())) throw new Error('已有同名组织或筹备申请')
    next.organizations.push({ id: localId('center'), parentId: 'platform', name: action.name.trim(), company: action.company.trim(), region: action.region.trim(), kind: action.kind, status: '待平台审核', applicantId: actor.accountId })
    title = '提交区县中心筹备申请'; target = action.name.trim(); result = '待审核（本地）'; detail = '未登记公司、开通商户、授予权限或复制农户数据。须由平台审核法定主体、辖区与授权协议后启用。'
  } else if (action.type === 'center.approve') {
    requirePermission(actor, 'centers.manage')
    const organization = next.organizations.find(o => o.id === action.id)
    if (!organization || organization.status !== '待平台审核' || organization.applicantId === actor.accountId) throw new Error('不能审批本人的中心申请或重复启用')
    organization.status = '演示已启用'
    next.socials.push(...emptySocialAccounts(organization.id))
    title = '审核区县中心演示申请'; target = organization.name; detail = '仅生成空的中心配置示例；不会复制福安农户、工单、合同、资金或管理员权限。'
  } else if (action.type === 'identity.save') {
    requirePermission(actor, 'identities.manage')
    const definition = action.definition
    validateIdentityDefinition(definition)
    if (definition.centerId !== actor.tenant || definition.status !== '待发布草案') throw new Error('仅维护当前中心的业务身份草案，不能修改基础模板或其他县域')
    if (next.identities.some(d => d.id !== definition.id && d.name === definition.name.trim() && d.industry === definition.industry)) throw new Error('当前产区已有同名身份')
    const existing = next.identities.find(d => d.id === definition.id)
    if (existing?.status === '基础模板') throw new Error('不能覆盖基础业务模板')
    next.identities = [{ ...definition, name: definition.name.trim(), admission: definition.admission.trim() }, ...next.identities.filter(d => d.id !== definition.id)].slice(0, 100)
    title = '保存产区业务身份草案'; target = definition.name.trim(); detail = '没有授予用户角色，也未同步至网页或小程序登录目录。正式启用须中心审核、服务端目录版本和客户端共享读取。'
  } else if (action.type === 'identity.export') {
    requirePermission(actor, 'identities.read')
    if (!Number.isInteger(action.count) || action.count < 0 || action.count > 100) throw new Error('目录数量无效')
    title = '导出产区身份目录草案'; target = `${action.count}条目录定义`; detail = '导出仅用于客户端/接口建设交接，不能据此给用户授予角色或管理员权限。'
  } else if (action.type === 'logs.export') {
    requirePermission(actor, 'logs.export')
    if (!Number.isInteger(action.count) || action.count < 0 || action.count > 200) throw new Error('导出数量无效')
    title = '导出演示日志'; target = `${action.count}条筛选记录`; detail = '仅导出脱敏示例字段；不含令牌、手机号、定位或原始请求体。'
  } else throw new Error('未知演示操作')
  const id = localId('log')
  next.logs.unshift({ id, at: new Date().toISOString(), category, level, actor: actor.name, action: title, target, result, detail, traceId: `demo-${id}` })
  next.logs = next.logs.slice(0, 200)
  next.requests = next.requests.slice(0, 100)
  next.news = next.news.slice(0, 100)
  return next
}

export function parseSystemState(raw: string | null, actor: SystemActor): SystemState {
  const fallback = () => createSystemState(actor)
  if (!raw) return fallback()
  try {
    const v = JSON.parse(raw) as SystemState
    // Compatible with earlier v2 local prototypes; this adds definitions, never grants.
    if (!v.identities) v.identities = initialIdentityDefinitions(actor.tenant)
    if (v.version !== 2 || v.tenant !== actor.tenant || v.accountId !== actor.accountId || !Array.isArray(v.news) || !v.news.every(isNewsArticle)
      || !Array.isArray(v.integrations) || v.integrations.length !== 6 || !Array.isArray(v.administrators) || !Array.isArray(v.requests) || !Array.isArray(v.logs)
      || !Array.isArray(v.organizations) || !Array.isArray(v.socials) || v.organizations.length > 100 || v.socials.length > 300
      || !Array.isArray(v.identities) || v.identities.length > 100
      || v.news.length > 100 || v.logs.length > 200 || v.requests.length > 100) return fallback()
    if (v.organizations.length < 4 || !['platform', 'fuan', 'saiqi', 'xibing'].every(id => v.organizations.some(o => o?.id === id))
      || new Set(v.organizations.map(o => o?.id)).size !== v.organizations.length
      || new Set(v.integrations.map(i => i?.id)).size !== v.integrations.length
      || new Set(v.administrators.map(a => a?.id)).size !== v.administrators.length
      || new Set(v.socials.map(a => `${a?.centerId}:${a?.id}`)).size !== v.socials.length) return fallback()
    for (const o of v.organizations) {
      if (!o || typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.company !== 'string' || typeof o.region !== 'string' || !organizationKinds.includes(o.kind) || !['目录示例', '试点规划', '待平台审核', '演示已启用'].includes(o.status) || typeof o.applicantId !== 'string' || o.parentId !== null && typeof o.parentId !== 'string') return fallback()
    }
    for (const a of v.socials) { validateSocialAccount(a); if (!v.organizations.some(o => o.id === a.centerId)) return fallback() }
    for (const d of v.identities) { validateIdentityDefinition(d); if (d.centerId !== actor.tenant) return fallback() }
    for (const i of v.integrations) {
      if (!i || typeof i.id !== 'string' || !createSystemState(actor).integrations.some(a => a.id === i.id) || typeof i.name !== 'string' || typeof i.owner !== 'string' || typeof i.endpoint !== 'string'
        || typeof i.description !== 'string' || typeof i.dataScope !== 'string' || typeof i.category !== 'string' || typeof i.authorization !== 'string' || !['未配置', '本地已配置', '本地已停用'].includes(i.status)) return fallback()
      validateEndpoint(i.endpoint)
    }
    for (const a of v.administrators) {
      if (!a || typeof a.id !== 'string' || typeof a.accountId !== 'string' || typeof a.name !== 'string' || !roleTemplates.some(r => r.id === a.roleId) || !centerScopes.some(s => s.id === a.scope) || !['启用', '停用'].includes(a.status) || !Number.isInteger(a.revision) || !Array.isArray(a.permissions)) return fallback()
      assertPermissionSet(a.permissions)
    }
    for (const r of v.requests) {
      if (!r || typeof r.id !== 'string' || typeof r.targetId !== 'string' || typeof r.requesterId !== 'string' || typeof r.reason !== 'string' || !roleTemplates.some(t => t.id === r.roleId) || !centerScopes.some(s => s.id === r.scope) || !['待审批', '演示已通过'].includes(r.status) || !Number.isInteger(r.targetRevision) || !Array.isArray(r.permissions)) return fallback()
      assertPermissionSet(r.permissions)
    }
    if (v.logs.some(l => !l || typeof l.id !== 'string' || typeof l.at !== 'string' || !Number.isFinite(Date.parse(l.at)) || !logCategories.includes(l.category) || !logLevels.includes(l.level) || ['actor', 'action', 'target', 'result', 'traceId', 'detail'].some(k => typeof l[k as keyof AuditEntry] !== 'string'))) return fallback()
    return v
  } catch { return fallback() }
}

export function csvCell(value: string) {
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}
export function logsCsv(rows: AuditEntry[]) {
  const columns: (keyof AuditEntry)[] = ['at', 'category', 'level', 'actor', 'action', 'target', 'result', 'traceId']
  return ['时间,类别,级别,操作者,操作,对象,结果,追踪ID', ...rows.map(row => columns.map(key => csvCell(row[key])).join(','))].join('\r\n')
}
