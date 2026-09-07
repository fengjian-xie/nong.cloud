import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { getSettingRows, saveMemberProfile } from '../api/mock'
import { normalizeMemberProfile, type MemberProfile } from '../api/memberProfile'
import type { OperationRow } from '../types'
import './MemberProfileEditor.css'

export function MemberProfileEditor({ member, onClose, onSaved }: { member: OperationRow; onClose: () => void; onSaved: (member: OperationRow) => void }) {
  const [draft, setDraft] = useState<MemberProfile>(() => ({ name: String(member.name), type: String(member.type), town: String(member.town), identities: String(member.identities || '') }))
  const [types, setTypes] = useState<OperationRow[]>([])
  const [towns, setTowns] = useState<OperationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const savingRef = useRef(false)
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement as HTMLElement | null
    element?.showModal()
    return () => { element?.close(); previousFocus?.focus() }
  }, [])
  useEffect(() => {
    let active = true
    Promise.all([getSettingRows('subjectTypes'), getSettingRows('locations')]).then(([typeRows, townRows]) => {
      if (active) { setTypes(typeRows.data.filter((row) => row.status === '启用')); setTowns(townRows.data.filter((row) => row.status === '启用')); setLoading(false) }
    }).catch(() => { if (active) setError('选项加载失败，请关闭后重试') })
    return () => { active = false }
  }, [])
  const options = (rows: OperationRow[], current: string) => [...new Set([current, ...rows.map((row) => String(row.name))])].filter(Boolean)
  const identities = [...new Set([...String(member.identities || '').split('、'), ...types.flatMap((row) => String(row.identities || '').split('、'))])].filter(Boolean)
  const selected = draft.identities.split('、').filter(Boolean)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (savingRef.current || loading) return
    setError('')
    try {
      const profile = normalizeMemberProfile(draft)
      savingRef.current = true; setSaving(true)
      const response = await saveMemberProfile(String(member.id), profile)
      onSaved(response.data)
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败，请重试') }
    finally { savingRef.current = false; setSaving(false) }
  }
  return createPortal(<dialog ref={dialog} className="member-edit-dialog" aria-labelledby="member-edit-title" onCancel={(event) => { event.preventDefault(); if (!savingRef.current) onClose() }}>
    <form onSubmit={save}>
      <header><h2 id="member-edit-title">编辑主体资料</h2><button type="button" className="icon-button" aria-label="关闭编辑" disabled={saving} onClick={onClose}><X size={20} /></button></header>
      <div className="member-edit-fields">
        <p>会员编号：{String(member.id)}</p>
        <label>主体名称<input autoFocus required maxLength={60} value={draft.name} disabled={saving} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>主体类型<select aria-label="主体类型" value={draft.type} disabled={loading || saving} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{options(types, String(member.type)).map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>所在乡镇<select aria-label="所在乡镇" value={draft.town} disabled={loading || saving} onChange={(event) => setDraft({ ...draft, town: event.target.value })}>{options(towns, String(member.town)).map((name) => <option key={name}>{name}</option>)}</select></label>
        <fieldset disabled={loading || saving}><legend>主体身份（可多选）</legend><div className="member-edit-identities">{identities.map((name) => <label key={name}><input type="checkbox" checked={selected.includes(name)} onChange={(event) => setDraft({ ...draft, identities: (event.target.checked ? [...selected, name] : selected.filter((item) => item !== name)).join('、') })} />{name}</label>)}</div></fieldset>
        <small>资料保存于当前浏览器；任务统计、评分与收支金额由业务数据计算，不在此修改。</small>
        {loading && !error ? <p role="status">正在加载选项…</p> : null}
        {error ? <p role="alert" className="member-edit-error">{error}</p> : null}
      </div>
      <footer><button type="button" className="secondary-button" disabled={saving} onClick={onClose}>取消</button><button type="submit" className="primary-inline" disabled={loading || saving}>{saving ? '保存中…' : '保存资料'}</button></footer>
    </form>
  </dialog>, document.body)
}
