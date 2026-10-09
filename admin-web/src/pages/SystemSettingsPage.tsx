import { KeyRound, MapPinned, Pencil, Plus, Save, Trash2, UserCog, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteSetting, getSettingRows, saveSetting, type SettingGroup } from '../api/mock'
import { PaginationBar } from '../components/PaginationBar'
import type { OperationRow } from '../types'

const groups = {
  administrators: { title: '管理员与权限', description: '管理员账号与最小权限配置', icon: UserCog, columns: [['name', '管理员'], ['role', '角色'], ['permissions', '权限范围']] },
  subjectTypes: { title: '主体类型', description: '主体类型及可申请的多重身份', icon: KeyRound, columns: [['name', '主体类型'], ['identities', '可选身份']] },
  locations: { title: '地块所在地', description: '乡镇、行政代码及村级范围', icon: MapPinned, columns: [['name', '乡镇'], ['code', '行政代码'], ['villages', '覆盖村']] },
} as const

const emptyByGroup: Record<SettingGroup, OperationRow> = {
  administrators: { id: '', name: '', phone: '', role: '', permissions: '', status: '启用' },
  subjectTypes: { id: '', name: '', identities: '', status: '启用' },
  locations: { id: '', name: '', code: '', villages: '', status: '启用' },
}

const permissionGroups = [
  { title: '业务管理', items: ['会员管理', '地块管理', '服务调度', '供需审核'] },
  { title: '系统管理', items: ['参数配置', '管理员管理', '主体类型管理', '所在地管理', '审计日志'] },
]
const allPermissions = permissionGroups.flatMap((section) => section.items)

export function SystemSettingsPage({ initialGroup = 'administrators' }: { initialGroup?: SettingGroup } = {}) {
  const [group, setGroup] = useState<SettingGroup>(initialGroup)
  const [rows, setRows] = useState<OperationRow[]>([])
  const [editing, setEditing] = useState<OperationRow | null>(null)
  const [toast, setToast] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const config = groups[group]

  useEffect(() => {
    if (group === 'administrators') return
    let active = true
    getSettingRows(group).then(({ data }) => { if (active) { setRows(data); setPage(1) } })
    return () => { active = false }
  }, [group])
  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(''), 1800) }
  const selectedPermissions = editing?.permissions === '全部模块' ? allPermissions : String(editing?.permissions || '').split(/[、，,]/).filter(Boolean)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  function togglePermission(permission: string) {
    if (!editing) return
    const next = selectedPermissions.includes(permission) ? selectedPermissions.filter((item) => item !== permission) : [...selectedPermissions, permission]
    setEditing({ ...editing, permissions: next.join('、') })
  }
  function toggleAllPermissions() {
    if (!editing) return
    setEditing({ ...editing, permissions: selectedPermissions.length === allPermissions.length ? '' : allPermissions.join('、') })
  }
  async function save() {
    if (!editing?.name) return notify('请填写名称')
    const { data } = await saveSetting(group, editing)
    setRows((current) => current.some((item) => item.id === data.id) ? current.map((item) => item.id === data.id ? data : item) : [data, ...current])
    setEditing(null); notify('设置已保存')
  }
  async function remove(row: OperationRow) {
    if (!window.confirm(`确认删除“${row.name}”吗？`)) return
    await deleteSetting(group, String(row.id)); setRows((current) => current.filter((item) => item.id !== row.id)); notify('已删除')
  }

  if (group === 'administrators') return <div className="settings-page">
    <div className="page-heading"><div><h1>系统设置</h1><p>管理员权限采用统一模块；主体字典和所在地设置继续保留。</p></div><Link className="primary-inline" to="/settings/permissions"><UserCog size={17}/>管理员权限设置</Link></div>
    <div className="settings-tabs">{(Object.keys(groups) as SettingGroup[]).map(key => { const Icon = groups[key].icon; return <button key={key} className={group === key ? 'active' : ''} onClick={() => { setGroup(key); setEditing(null); setPage(1) }}><Icon size={18}/><span><strong>{groups[key].title}</strong><small>{groups[key].description}</small></span></button> })}</div>
    <section className="panel" style={{ padding: 24 }}><h2>岗位权限与独立审批</h2><p>查看与操作权限、服务中心范围、变更申请和日志已集中到管理员权限模块。旧的“全部模块即时生效”编辑入口已停用。</p><p>当前仅本机演示，不更改真实登录或生产权限。</p><Link className="secondary-button" to="/settings/permissions">打开管理员权限设置 →</Link></section>
  </div>

  return <div className="settings-page">
    <div className="page-heading"><div><h1>系统设置</h1><p>统一维护后台账号权限、主体字典与福安地块行政区划</p></div><button className="primary-inline" onClick={() => setEditing({ ...emptyByGroup[group] })}><Plus size={17}/>新增{config.title}</button></div>
    <div className="settings-tabs">{(Object.keys(groups) as SettingGroup[]).map((key) => { const Icon = groups[key].icon; return <button key={key} className={group === key ? 'active' : ''} onClick={() => { setGroup(key); setEditing(null); setPage(1) }}><Icon size={18}/><span><strong>{groups[key].title}</strong><small>{groups[key].description}</small></span></button> })}</div>
    <section className="panel operation-panel"><div className="panel-head"><div><h2>{config.title}</h2><p>{config.description} · 支持新增、编辑和删除</p></div><span className="settings-count">{rows.length} 条</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>序号</th>{config.columns.map(([, label]) => <th key={label}>{label}</th>)}<th>状态</th><th>操作</th></tr></thead><tbody>{paginatedRows.map((row, index) => <tr key={String(row.id)}><td className="serial-cell">{(currentPage - 1) * pageSize + index + 1}</td>{config.columns.map(([key]) => <td key={key}>{String(row[key] || '—')}</td>)}<td><span className="status-chip positive">{String(row.status)}</span></td><td><div className="row-actions"><button onClick={() => setEditing({ ...row })}><Pencil size={14}/>编辑</button><button className="danger" onClick={() => remove(row)}><Trash2 size={14}/>删除</button></div></td></tr>)}</tbody></table></div><PaginationBar total={rows.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}/></section>
    {editing ? <div className="drawer-layer"><button className="drawer-scrim" onClick={() => setEditing(null)} aria-label="关闭"/><aside className="detail-drawer"><div className="drawer-head"><div><span>系统设置</span><h2>{editing.id ? `编辑${config.title}` : `新增${config.title}`}</h2></div><button className="icon-button" onClick={() => setEditing(null)}><X/></button></div><div className="settings-form">{Object.keys(editing).filter((key) => !['id', 'status'].includes(key)).map((key) => key === 'permissions' ? <fieldset className="permission-fieldset" key={key}><legend>权限范围</legend><label className="permission-all"><input type="checkbox" checked={selectedPermissions.length === allPermissions.length} onChange={toggleAllPermissions}/><span>全部权限</span><small>勾选或取消全部模块</small></label>{permissionGroups.map((section) => <div className="permission-section" key={section.title}><strong>{section.title}</strong><div>{section.items.map((permission) => <label key={permission}><input type="checkbox" checked={selectedPermissions.includes(permission)} onChange={() => togglePermission(permission)}/><span>{permission}</span></label>)}</div></div>)}<p>已选择 {selectedPermissions.length} / {allPermissions.length} 项</p></fieldset> : <label key={key}><span>{({ name: '名称', phone: '手机号', role: '角色', identities: '身份（逗号分隔）', code: '行政代码', villages: '覆盖村（逗号分隔）' } as Record<string,string>)[key] || key}</span><input value={String(editing[key] || '')} onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}/></label>)}<label><span>状态</span><select value={String(editing.status)} onChange={(e) => setEditing({ ...editing, status: e.target.value })}><option>启用</option><option>停用</option></select></label><div className="permission-tip"><KeyRound size={16}/><span>当前仅为主体与行政区划字典演示；真实后台配置、权限和审计需服务端接入。</span></div></div><div className="drawer-actions"><button className="secondary-button" onClick={() => setEditing(null)}>取消</button><button className="primary-inline" onClick={save}><Save size={16}/>保存设置</button></div></aside></div> : null}
    {toast ? <div className="toast">{toast}</div> : null}
  </div>
}
