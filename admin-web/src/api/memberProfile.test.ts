// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeMemberProfile, persistMemberProfile, readMemberProfile } from './memberProfile'
import { getMember, getModuleRows, saveMemberProfile } from './mock'

afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })
const profile = { name: '新名称', type: '个人会员', town: '溪柄镇', identities: '种植户、采购商' }
describe('主体资料编辑', () => {
  it('校验必填字段、去除空格和重复身份', () => {
    expect(normalizeMemberProfile({ ...profile, name: ' 新名称 ', identities: '种植户、种植户、采购商' })).toEqual(profile)
    expect(() => normalizeMemberProfile({ ...profile, name: ' ' })).toThrow('主体名称')
    expect(() => normalizeMemberProfile({ ...profile, name: '名'.repeat(61) })).toThrow('主体名称')
    expect(() => normalizeMemberProfile({ ...profile, town: '' })).toThrow('乡镇')
    expect(() => normalizeMemberProfile({ ...profile, identities: '' })).toThrow('身份')
  })
  it('按会员隔离保存，仅允许基础字段覆盖，损坏存储可恢复', () => {
    const member = { id: 'MB1', name: '原名称', incomeAmount: 123, taskCompletion: '80%' }
    persistMemberProfile('MB1', profile, '2026-08-30 15:00')
    expect(readMemberProfile(member)).toMatchObject({ ...profile, incomeAmount: 123, taskCompletion: '80%' })
    expect(readMemberProfile({ ...member, id: 'MB2' }).name).toBe('原名称')
    localStorage.setItem('fuan.member-profile.v1.MB1', '{broken')
    expect(readMemberProfile(member)).toEqual(member)
    localStorage.setItem('fuan.member-profile.v1.MB1', JSON.stringify({ ...profile, incomeAmount: 999 }))
    expect(readMemberProfile(member).incomeAmount).toBe(123)
  })
  it('无法存储时明确报错，不假报保存成功', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(() => persistMemberProfile('MB1', profile, '')).toThrow('无法保存')
  })
  it('保存后详情、列表读到同一资料，统计保持不变', async () => {
    const id = 'MB20260829001'
    const before = (await getMember(id)).data
    const saved = (await saveMemberProfile(id, profile)).data
    expect(saved.name).toBe(profile.name)
    expect(saved.incomeAmount).toBe(before.incomeAmount)
    expect(saved.taskCompletion).toBe(before.taskCompletion)
    expect((await getMember(id)).data.name).toBe(profile.name)
    expect((await getModuleRows('members')).data.find((row) => row.id === id)?.name).toBe(profile.name)
  })
  it('拒绝未知会员与未配置的乡镇、身份', async () => {
    await expect(saveMemberProfile('missing', profile)).rejects.toThrow()
    await expect(saveMemberProfile('MB20260829001', { ...profile, town: '未知乡镇' })).rejects.toThrow('乡镇')
    await expect(saveMemberProfile('MB20260829001', { ...profile, identities: '未知身份' })).rejects.toThrow('身份选项')
  })
})
