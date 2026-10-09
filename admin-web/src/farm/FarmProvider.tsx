import { createContext, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createFarmSeed, now, transition, uid } from './model'
import type { Action, FarmState } from './model'

const STORAGE_KEY = 'xiangqiao-admin-demo-actions-v1'
type Command = Action extends infer A ? A extends Action ? Omit<A, 'at' | 'eventId'> : never : never
type FarmContextValue = { state: FarmState; commit: (command: Command) => boolean; notice: string; storageWarning: string }
const FarmContext = createContext<FarmContextValue | null>(null)

// Persist a small event journal, not real farmer data, binary media, credentials or entire API responses.
function restore(storageKey: string) {
  const seed = createFarmSeed()
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { state: seed, actions: [] as Action[], warning: '' }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length > 1000 || parsed.some(a => !a || typeof a.type !== 'string' || typeof a.eventId !== 'string' || typeof a.at !== 'string')) throw new Error('Invalid demo journal')
    const actions = parsed as Action[]
    return { state: actions.reduce(transition, seed), actions, warning: '' }
  } catch { return { state: seed, actions: [] as Action[], warning: '本地演示缓存不可用或已过期，已恢复示例；原缓存未删除。' } }
}

export function FarmProvider({ children, storageKey = STORAGE_KEY }: { children: ReactNode; storageKey?: string }) {
  const [initial] = useState(() => restore(storageKey))
  const [state, setState] = useState(initial.state)
  const current = useRef(initial.state)
  const actions = useRef(initial.actions)
  const [notice, setNotice] = useState('')
  const [storageWarning, setStorageWarning] = useState(initial.warning)
  function commit(command: Command) {
    try {
      if (actions.current.length >= 1000) throw new Error('演示日志已达容量上限，请使用独立测试浏览器；正式数据需接入服务端')
      const action = { ...command, at: now(), eventId: uid('EVT') } as Action
      const next = transition(current.current, action)
      current.current = next; actions.current = [...actions.current, action]; setState(next)
      try { localStorage.setItem(storageKey, JSON.stringify(actions.current)); setStorageWarning('') }
      catch { setStorageWarning('浏览器禁止存储或空间不足，本次操作仅在当前会话有效。') }
      setNotice(next.audit[0].message)
      return true
    } catch (error) { setNotice(error instanceof Error ? error.message : '操作失败'); return false }
  }
  return <FarmContext.Provider value={{ state, commit, notice, storageWarning }}>{children}</FarmContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFarm() {
  const value = useContext(FarmContext)
  if (!value) throw new Error('FarmProvider is required')
  return value
}
