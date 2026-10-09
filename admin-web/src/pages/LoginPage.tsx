import { ArrowRight, CheckCircle2, MapPinned, ShieldCheck } from 'lucide-react'
import { BrandLockup } from '../brand/BrandLockup'
import { FormEvent, useState } from 'react'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { login, warning } = useAuth()
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
        <div className="login-brand"><BrandLockup reverse context="管理后台 · 福安运营中心" domain="m.nong.cloud" stacked/></div>
        <div className="login-copy"><h1>让每一项农事服务<br />都有人跟进、有据可查。</h1><p>面向福安市县域运营人员的一期工作平台，统一处理主体、地块、服务和运营待办。</p></div>
        <div className="login-facts">
          <div><MapPinned /><span><strong>福安市</strong><small>countyCode 350981</small></span></div>
          <div><ShieldCheck /><span><strong>演示县域范围</strong><small>fuan · 非生产权限隔离</small></span></div>
          <div><CheckCircle2 /><span><strong>农户免平台服务费</strong><small>记录与产销后台演示，外部接口待接入</small></span></div>
        </div>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <div className="form-head"><h2>运营账号演示登录</h2><p>原型体验，不连接真实账号或财务系统</p></div>
          <label>手机号<input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" autoComplete="tel" /></label>
          <label>验证码<div className="code-field"><input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" /><button type="button" onClick={() => setCode('000000')}>填入Mock码</button></div></label>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          {warning ? <div className="form-error" role="status">{warning}</div> : null}
          <button className="primary-button" disabled={submitting}>{submitting ? '正在验证…' : <>登录运营后台 <ArrowRight size={18} /></>}</button>
          <p className="form-tip">演示验证码：<strong>000000</strong>。请勿录入真实个人或交易资料；真实认证与对象权限待后端接入。</p>
        </form>
      </section>
    </div>
  )
}
