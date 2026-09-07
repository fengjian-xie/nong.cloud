import { ArrowRight, CheckCircle2, MapPinned, ShieldCheck, Sprout } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const [phone, setPhone] = useState('13812345678')
  const [code, setCode] = useState('000000')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSubmitting(true)
    try { await login(phone, code) } catch (err) { setError(err instanceof Error ? err.message : '登录失败，请稍后重试') } finally { setSubmitting(false) }
  }

  return (
    <div className="login-page">
      <section className="login-context">
        <div className="login-brand"><span><Sprout /></span><strong>福安农事运营中心</strong></div>
        <div className="login-copy"><h1>让每一项农事服务<br />都有人跟进、有据可查。</h1><p>面向福安市县域运营人员的一期工作平台，统一处理主体、地块、服务和运营待办。</p></div>
        <div className="login-facts">
          <div><MapPinned /><span><strong>福安市</strong><small>countyCode 350981</small></span></div>
          <div><ShieldCheck /><span><strong>可信租户隔离</strong><small>tenantCode fuan</small></span></div>
          <div><CheckCircle2 /><span><strong>一期范围已约束</strong><small>不含支付、追溯和跨县</small></span></div>
        </div>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <div className="form-head"><h2>运营账号登录</h2><p>使用手机号和验证码进入福安工作台</p></div>
          <label>手机号<input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" autoComplete="tel" /></label>
          <label>验证码<div className="code-field"><input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" /><button type="button" onClick={() => setCode('000000')}>填入Mock码</button></div></label>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <button className="primary-button" disabled={submitting}>{submitting ? '正在验证…' : <>登录运营后台 <ArrowRight size={18} /></>}</button>
          <p className="form-tip">演示验证码：<strong>000000</strong>。真实短信能力不在当前切片。</p>
        </form>
      </section>
    </div>
  )
}
