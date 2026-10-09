import { describe, expect, it } from 'vitest'
import { applySystemAction, createSystemState, csvCell, makeActor, parseSystemState, roleTemplates, systemStorageKey, validateEndpoint } from './model'
import { initialNews, publishedNews, readPublicNewsPreview } from '../content/news'
import { emptySocialAccounts, readSocialPreview, validateSocialAccount } from '../content/social'

const actor = makeActor({ id: 'admin-fuan-001', name: '陈晓岚', role: '县域运营管理员' })
const permissions = (id: string) => roleTemplates.find(r => r.id === id)!.permissions

describe('系统管理本机状态与权限边界', () => {
  it('缓存按账号和中心隔离，未知岗位不获得管理员权限', () => {
    const state = createSystemState(actor)
    expect(parseSystemState(JSON.stringify(state), { ...actor, accountId: 'other' }).accountId).toBe('other')
    expect(parseSystemState(JSON.stringify(state), { ...actor, tenant: 'other-center' }).tenant).toBe('other-center')
    expect(systemStorageKey('fuan', 'a')).not.toBe(systemStorageKey('fuan', 'b'))
    expect(makeActor({ id: 'a', name: 'a', role: '未知角色' }).permissions).toEqual([])
    expect(parseSystemState('{broken', actor).version).toBe(2)
    expect(parseSystemState(JSON.stringify({ ...state, logs: [{}] }), actor).logs[0].id).toBe('log-start')
  })
  it('接口只保存不含凭据的HTTPS地址，格式检查不代表真实连接', () => {
    let state = createSystemState(actor)
    for (const url of ['http://example.invalid/api', 'https://localhost/api', 'https://127.0.0.1/api', 'https://[::1]/api', 'https://u:p@example.invalid/api', 'https://example.invalid/api?token=abc', 'https://example.invalid/#secret']) expect(() => validateEndpoint(url)).toThrow()
    state = applySystemAction(state, { type: 'integration.save', id: 'trace', endpoint: 'https://provider.example.invalid/api', owner: '测试经办', authorization: '机构授权（待接入）' }, actor)
    expect(state.integrations[0].status).toBe('本地已配置')
    state = applySystemAction(state, { type: 'integration.check', id: 'trace' }, actor)
    expect(state.logs[0].result).toBe('未执行')
    expect(state.logs[0].detail).toContain('未发起连接或上传')
    expect(() => applySystemAction(state, { type: 'integration.pause', id: 'trace' }, { ...actor, permissions: permissions('auditor') })).toThrow('没有此操作权限')
  })
  it('权限变更不能自改、自批、跨范围或授予超出自身的权限', () => {
    const state = createSystemState(actor)
    const request = { type: 'permission.request' as const, targetId: 'admin-editor', roleId: 'auditor', scope: 'fuan' as const, permissions: permissions('auditor'), reason: '测试申请只读审计权限，便于核对内容记录。' }
    expect(() => applySystemAction(state, { ...request, targetId: 'admin-current' }, actor)).toThrow('不能自行')
    expect(() => applySystemAction(state, { ...request, roleId: 'finance', permissions: permissions('finance') }, actor)).toThrow('超出自身')
    expect(() => applySystemAction(state, request, { ...actor, scope: 'saiqi' })).toThrow('服务中心范围')
    const pending = applySystemAction(state, request, actor)
    expect(pending.administrators.find(a => a.id === 'admin-editor')!.revision).toBe(1)
    expect(() => applySystemAction(pending, { type: 'permission.approve', id: pending.requests[0].id }, actor)).toThrow('不能审批本人')
    expect(() => applySystemAction(pending, request, actor)).toThrow('待审批申请')
  })
  it('其他账号示例申请可独立审核，权限版本变化后拒绝旧审批', () => {
    const state = createSystemState(actor)
    const changed = applySystemAction(state, { type: 'permission.approve', id: 'permission-example' }, actor)
    expect(changed.administrators.find(a => a.id === 'admin-support')!.revision).toBe(2)
    expect(changed.requests[0].status).toBe('演示已通过')
    state.administrators.find(a => a.id === 'admin-support')!.revision = 2
    expect(() => applySystemAction(state, { type: 'permission.approve', id: 'permission-example' }, actor)).toThrow('版本已改变')
  })
  it('新闻草稿与待审核稿不进入公开列表，不能审核自己的稿件', () => {
    let state = createSystemState(actor)
    const draft = { ...initialNews[0], id: 'draft-test', title: '测试新闻标题', summary: '这是一条测试新闻的摘要。', body: '这是一条用于验证草稿隔离、提交与独立审核的演示新闻正文。', status: '草稿' as const }
    state = applySystemAction(state, { type: 'news.save', article: draft }, actor)
    expect(publishedNews(state.news).some(a => a.id === draft.id)).toBe(false)
    state = applySystemAction(state, { type: 'news.submit', id: draft.id }, actor)
    expect(() => applySystemAction(state, { type: 'news.approve', id: draft.id }, actor)).toThrow('不能审核自己参与编辑')
    expect(() => applySystemAction(state, { type: 'news.save', article: draft }, actor)).toThrow('不能直接修改')
    state = applySystemAction(state, { type: 'news.approve', id: 'news-pilot-draft' }, actor)
    expect(publishedNews(state.news).some(a => a.id === 'news-pilot-draft')).toBe(true)
    expect(readPublicNewsPreview(JSON.stringify({ version: 1, articles: state.news })).some(a => a.id === draft.id)).toBe(false)
  })
  it('社交账号只接受对应官方域名，县域不能覆盖平台账号', () => {
    const state = createSystemState(actor)
    const account = { ...emptySocialAccounts('fuan')[1], accountName: '测试中心账号', href: 'https://www.douyin.com/user/test-demo', enabled: true }
    const saved = applySystemAction(state, { type: 'social.save', account }, actor)
    expect(saved.socials.find(a => a.centerId === 'fuan' && a.id === 'douyin')!.enabled).toBe(true)
    expect(saved.socials.find(a => a.centerId === 'platform' && a.id === 'douyin')!.enabled).toBe(false)
    expect(() => applySystemAction(state, { type: 'social.save', account: { ...account, centerId: 'platform' } }, actor)).toThrow('其他服务中心')
    expect(() => applySystemAction(state, { type: 'social.save', account: { ...account, centerId: 'xibing' } }, { ...actor, scope: 'saiqi' })).toThrow('其他服务中心')
    for (const href of ['javascript:alert(1)', 'https://www.douyin.com.attacker.invalid/u', 'https://www.xiaohongshu.com/u', 'https://www.douyin.com/u?secret=1']) expect(() => validateSocialAccount({ ...account, href })).toThrow()
    expect(readSocialPreview(JSON.stringify({ version: 1, centerId: 'other', accounts: emptySocialAccounts('other') }), 'fuan')).toEqual(emptySocialAccounts('fuan'))
  })
  it('新增中心只生成筹备申请，县域不能启用或复制数据', () => {
    const state = applySystemAction(createSystemState(actor), { type: 'center.request', name: '测试县农事服务中心', company: '测试县乡桥农事服务有限公司', kind: '分公司运营中心', region: '测试省测试市测试县测试地址' }, actor)
    const center = state.organizations.at(-1)!
    expect(center.status).toBe('待平台审核')
    expect(state.socials.some(a => a.centerId === center.id)).toBe(false)
    expect(() => applySystemAction(state, { type: 'center.approve', id: center.id }, actor)).toThrow('没有此操作权限')
    const system = { ...actor, permissions: permissions('system') }
    expect(() => applySystemAction(state, { type: 'center.approve', id: center.id }, system)).toThrow('不能审批本人的')
    state.organizations.at(-1)!.applicantId = 'other-demo-account'
    const approved = applySystemAction(state, { type: 'center.approve', id: center.id }, system)
    expect(approved.socials.filter(a => a.centerId === center.id)).toHaveLength(3)
    expect(approved.administrators).toEqual(state.administrators)
  })
  it('日志导出防止CSV公式注入，不包含原始请求体或联系方式', () => {
    expect(csvCell(' =HYPERLINK("bad")')).toBe('"\' =HYPERLINK(""bad"")"')
    const state = applySystemAction(createSystemState(actor), { type: 'logs.export', count: 3 }, actor)
    expect(state.logs[0].action).toBe('导出演示日志')
    expect(state.logs[0].detail).toContain('不含令牌')
  })
  it('新闻贡献者都不能自审，非法日期与旧版本拒绝保存', () => {
    const state = createSystemState(actor)
    const a = { ...initialNews[0], status: '草稿' as const, contributors: [actor.accountId], authorId: 'other-editor' }
    state.news[0] = a
    expect(() => applySystemAction(state, { type: 'news.save', article: { ...a, date: '2026-02-31' } }, actor)).toThrow('新闻格式无效')
    expect(() => applySystemAction(state, { type: 'news.save', article: { ...a, revision: 0 } }, actor)).toThrow()
    state.news[0].status = '待审核'
    expect(() => applySystemAction(state, { type: 'news.approve', id: a.id }, actor)).toThrow('参与编辑')
  })
  it('产区身份名称可扩展，流程模板不变，保存草案不授权', () => {
    const original = createSystemState(actor)
    const definition = { id: 'grape-pruning', centerId: 'fuan', name: '葡萄修剪队（测试）', industry: '葡萄产区', templateId: 'team' as const, admission: '需核验修剪服务能力，受托作业后由独立账号验收。', status: '待发布草案' as const }
    const changed = applySystemAction(original, { type: 'identity.save', definition }, actor)
    expect(changed.identities[0].templateId).toBe('team')
    expect(changed.administrators).toEqual(original.administrators)
    expect(changed.logs[0].detail).toContain('没有授予用户角色')
    expect(() => applySystemAction(original, { type: 'identity.save', definition: { ...definition, centerId: 'other-county' } }, actor)).toThrow('其他县域')
    expect(() => applySystemAction(original, { type: 'identity.save', definition: { ...definition, templateId: 'admin' as 'team' } }, actor)).toThrow('有效的产区身份')
    expect(applySystemAction(changed, { type: 'identity.export', count: changed.identities.length }, actor).logs[0].action).toBe('导出产区身份目录草案')
  })
})
