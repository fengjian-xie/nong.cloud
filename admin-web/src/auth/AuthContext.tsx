import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getMe, login as loginRequest } from '../api/mock'
import type { Session } from '../types'

type AuthValue = {
  session: Session | null
  restoring: boolean
  login: (phone: string, code: string) => Promise<void>
  logout: () => void
}

const STORAGE_KEY = 'fuan-admin-session-v1'
const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    let active = true
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      setRestoring(false)
      return
    }
    const stored = JSON.parse(raw) as Session
    getMe(stored.token)
      .then(({ data: user }) => {
        if (active) setSession({ ...stored, user })
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => active && setRestoring(false))
    return () => { active = false }
  }, [])

  const login = useCallback(async (phone: string, code: string) => {
    const { data } = await loginRequest(phone, code)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setSession(data)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSession(null)
  }, [])

  const value = useMemo(() => ({ session, restoring, login, logout }), [session, restoring, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// AuthProvider and its hook intentionally share one module so the context remains private.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
