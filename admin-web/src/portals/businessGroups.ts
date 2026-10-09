import registry from '../../../miniapp/utils/business-groups.json'
import { moduleLabels, rolePath, type ModuleId, type Role } from './config'

export type BusinessEntry = { id: ModuleId; title: string; variants: ModuleId[] }
export function businessGroups(role: Role) {
  const allowed = new Set<string>(role.modules)
  return registry.map(group => ({ id: group.id, title: group.title, entries: group.entries.flatMap(entry => {
    const variants = entry.members.filter(id => allowed.has(id)) as ModuleId[]
    return variants.length ? [{ id: variants[0], title: variants.length === 1 ? moduleLabels[variants[0]] : entry.title, variants }] : []
  }) })).filter(group => group.entries.length)
}
export function businessEntryPath(role: Role, module: ModuleId) {
  return module === 'value-feedback' ? `${rolePath(role.id)}/help` : rolePath(role.id, module)
}
