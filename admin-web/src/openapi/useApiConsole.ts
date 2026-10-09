import { useRef, useState } from 'react'
import { createApiSeed, restoreApps, simulateApi, STORAGE_KEY, updateApps } from './model'
import type { AppCommand, DebugInput } from './model'

export function useApiConsole() {
  const [initial] = useState(() => {
    try { return { state: createApiSeed(restoreApps(localStorage.getItem(STORAGE_KEY))), warning: '' } }
    catch { return { state: createApiSeed(), warning: '本机应用缓存不可用，已使用默认演示应用。未读取生产数据。' } }
  })
  const [state, setState] = useState(initial.state)
  const current = useRef(initial.state)
  const [warning, setWarning] = useState(initial.warning)
  const [notice, setNotice] = useState('')
  const command = (action: AppCommand) => {
    const next = updateApps(current.current, action)
    current.current = next; setState(next); setNotice(next.audit[0])
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next.apps)); setWarning('') }
    catch { setWarning('本机存储不可用；本次操作仅在当前页面有效，刷新后可能丢失。演示密钥与调用记录均不持久保存。') }
    return next
  }
  const run = (input: DebugInput) => {
    const result = simulateApi(current.current, input)
    current.current = result.state; setState(result.state)
    return result
  }
  return { state, warning, notice, command, run, setNotice }
}
