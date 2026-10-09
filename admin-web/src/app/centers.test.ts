import { describe, expect, it } from 'vitest'
import { adminCenters, centerPath, legacyAdminPath, mergeLegacyLocation } from './centers'
import { businessGroups, businessEntryPath } from '../portals/businessGroups'
import { roles } from '../portals/config'

describe('九中心与跨端业务入口', () => {
  it('九个中心唯一，二级功能唯一，不创建额外权限', () => {
    expect(adminCenters).toHaveLength(9)
    expect(new Set(adminCenters.map(c => c.id)).size).toBe(9)
    for (const c of adminCenters) expect(new Set(c.tabs.map(t => t.id)).size).toBe(c.tabs.length)
    expect(centerPath('finance')).toBe('/manage/finance/settlement')
  })
  it.each([
    ['/cards','/manage/production/cards'], ['/settings/permissions','/manage/platform/permissions'], ['/audit','/manage/platform/permissions'],
    ['/production/value/feedback','/manage/customer/support'], ['/services/help-center','/manage/customer/support'],
    ['/merchants','/manage/trade/membership'], ['/open-api','/manage/platform/api'],
    ['/members/M-01','/manage/subjects/members/M-01'], ['/plots/PL-01','/manage/production/plots/PL-01'],
    ['/services/S-01','/manage/services/orders/S-01'], ['/tasks/T-01','/manage/overview/tasks/T-01'],
  ])('旧入口 %s 保留对应业务与详情ID', (from, to) => expect(legacyAdminPath(from)).toBe(to))
  it('跳转保留筛选与锚点，不覆盖已有视图参数', () => {
    expect(mergeLegacyLocation('/maturity','?plot=PL-01','#detail')).toBe('/manage/trade/supply?plot=PL-01&view=map#detail')
    expect(mergeLegacyLocation('/maturity','?view=calendar','')).toBe('/manage/trade/supply?view=calendar')
    expect(legacyAdminPath('/settings/unknown')).toBeNull()
  })
  it.each(roles)('$name所有旧业务仍有可达视图，不多授予模块', role => {
    const entries = businessGroups(role).flatMap(g => g.entries)
    expect(entries.flatMap(e => e.variants).sort()).toEqual([...role.modules].sort())
    expect(new Set(entries.map(e => e.id)).size).toBe(entries.length)
    expect(entries.some(e => /分账|商户结算/.test(e.title))).toBe(false)
    for (const entry of entries) expect(businessEntryPath(role, entry.id)).toMatch(new RegExp(`^/workspace/${role.id}/`))
  })
  it('重复业务一处入口，私有成本不向采购身份显示', () => {
    const farmer = businessGroups(roles.find(r => r.id === 'farmer')!).flatMap(g => g.entries)
    expect(farmer.find(e => e.title === '成本与经营')?.variants).toEqual(['value-income','costs','value-history'])
    const buyer = businessGroups(roles.find(r => r.id === 'buyer')!).flatMap(g => g.entries)
    expect(buyer.some(e => e.variants.includes('costs') || e.variants.includes('value-income'))).toBe(false)
    expect(businessEntryPath(roles.find(r => r.id === 'buyer')!, 'value-feedback')).toBe('/workspace/buyer/help')
  })
})
