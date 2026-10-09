import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getMe, login as loginRequest } from '../api/mock'
import type { Session } from '../types'

type AuthValue = {
  session: Session | null
  restoring: boolean
  login: (phone: string, code: string) => Promise<void>
  logout: () => void
  warning: string
}

const STORAGE_KEY = 'fuan-admin-session-v1'
const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [warning, setWarning] = useState('')
  const generation = useRef(0)

  useEffect(() => {
    let active = true
    const revision = generation.current
    let stored: Session
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) { setRestoring(false); return }
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || !('token' in parsed) || typeof parsed.token !== 'string' || !parsed.token) throw new Error('Invalid cached session')
      stored = parsed as Session
    } catch {
      setWarning('演示会话缓存不可用或格式损坏，请重新登录。原缓存未删除，不影响其他账号草稿。')
      setRestoring(false)
      return
    }
    getMe(stored.token)
      .then(({ data: user }) => {
        if (active && revision === generation.current) setSession({ ...stored, user })
      })
      .catch(() => { if (active && revision === generation.current) setWarning('演示会话已失效，请重新登录；原有业务草稿未删除。') })
      .finally(() => { if (active && revision === generation.current) setRestoring(false) })
    return () => { active = false }
  }, [])

  const login = useCallback(async (phone: string, code: string) => {
    const revision = ++generation.current
    setRestoring(false)
    const { data } = await loginRequest(phone, code)
    if (revision !== generation.current) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); setWarning('') }
    catch { setWarning('本地储存不可用，本次演示登录仅在当前页面有效。') }
    setSession(data)
  }, [])

  const logout = useCallback(() => {
    generation.current++
    setRestoring(false)
    try { localStorage.removeItem(STORAGE_KEY); setWarning('') }
    catch { setWarning('当前页面已退出，但无法清理本地演示会话；共享设备请关闭页面。') }
    setSession(null)
  }, [])

  const value = useMemo(() => ({ session, restoring, login, logout, warning }), [session, restoring, login, logout, warning])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// AuthProvider and its hook intentionally share one module so the context remains private.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
