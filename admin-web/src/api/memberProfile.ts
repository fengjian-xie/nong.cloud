import type { OperationRow } from '../types'

export type MemberProfile = { name: string; type: string; town: string; identities: string }
const storageKey = (id: string) => `fuan.member-profile.v1.${id}`

export function normalizeMemberProfile(input: MemberProfile): MemberProfile {
  const name = String(input.name || '').trim()
  const type = String(input.type || '').trim()
  const town = String(input.town || '').trim()
  const identities = [...new Set(String(input.identities || '').split('、').map((item) => item.trim()).filter(Boolean))].join('、')
  if (!name || name.length > 60) throw new Error('主体名称须为1至60个字符')
  if (!type || !town) throw new Error('请选择主体类型和所在乡镇')
  if (!identities) throw new Error('请至少选择一种身份')
  return { name, type, town, identities }
}

export function readMemberProfile(member: OperationRow): OperationRow {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(String(member.id))) || 'null')
    if (!value) return member
    const profile = normalizeMemberProfile(value)
    return { ...member, ...profile, updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : member.updatedAt }
  } catch { return member }
}

export function persistMemberProfile(id: string, profile: MemberProfile, updatedAt: string) {
  try { localStorage.setItem(storageKey(id), JSON.stringify({ ...normalizeMemberProfile(profile), updatedAt })) }
  catch { throw new Error('无法保存到当前浏览器，请允许本地存储后重试') }
}
