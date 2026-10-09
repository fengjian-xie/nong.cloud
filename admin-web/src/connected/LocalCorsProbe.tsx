import { useState } from 'react'

// Read-only local diagnosis. No token, private data, arbitrary target or write operation.
export function LocalCorsProbe() {
  const [status, setStatus] = useState('尚未检查跨端口连接'), [busy, setBusy] = useState(false)
  if (!['127.0.0.1', 'localhost'].includes(window.location.hostname)) return null
  async function check() {
    setBusy(true)
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch('http://127.0.0.1:8080/api/v1/health', { mode: 'cors', credentials: 'include', headers: { 'X-XQ-Client': 'web-v1' }, signal: controller.signal })
      const envelope = await response.json()
      if (!response.ok || envelope.code !== 0 || envelope.data?.database !== 'postgresql') throw new Error(envelope.message || '接口状态异常')
      setStatus(`跨域预检及读取通过：${window.location.origin} → 127.0.0.1:8080；PostgreSQL 已连接`)
    } catch { setStatus('跨端口读取未通过：请检查后端是否运行、Origin 白名单、端口与浏览器网络错误；未使用模拟结果。') }
    finally { clearTimeout(timer); setBusy(false) }
  }
  return <section className="connected-boundary"><h2>本地跨域检查</h2><p>日常联调走同源 /api/v1 代理。此检查会单独从当前页面跨端口读取健康接口，验证浏览器预检与 CORS；不会读取业务数据或执行写入。</p><button disabled={busy} onClick={() => void check()}>检查跨域连接</button><p role="status">{status}</p></section>
}
