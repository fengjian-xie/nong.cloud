import { BrandLockup } from '../brand/BrandLockup'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { getRole } from '../portals/config'
import { demoAccounts, getDemoAccount } from './site'
import type { DemoAccount } from './site'

export function WorkLogin({ initialAccount = 'farm-service', onEnter, warning }: { initialAccount?: DemoAccount['id']; onEnter: (account: DemoAccount) => void; warning: string }) {
  const [accountId, setAccountId] = useState<DemoAccount['id']>(initialAccount)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const account = getDemoAccount(accountId) || demoAccounts[0]
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!consent) { setError('请先确认演示账号说明。'); return }
    setError(''); onEnter(account)
  }
  return <div className="work-login">
    <header className="work-header"><a className="work-brand" href="https://nong.cloud/" aria-label="乡桥农事官网"><BrandLockup context="用户工作台" domain="work.nong.cloud"/></a><nav aria-label="平台入口"><a href="https://nong.cloud/">官网</a><a href="https://nc.nong.cloud/">云农场</a><a href="https://api.nong.cloud/">开放 API</a></nav></header>
    <main className="work-entry"><section className="work-intro"><h1>把农事做扎实，<br/>把协作接起来。</h1><p>记录生产，协同服务，连接采购。</p><img src={`${import.meta.env.BASE_URL}brand/fuan-vineyard.jpg`} alt="用户提供的福安葡萄园航拍照片" width="1920" height="1280" {...{ fetchpriority: 'high' }}/></section>
      <section className="work-form-region" aria-labelledby="work-login-heading"><h2 id="work-login-heading">进入主体工作台</h2><p className="work-subtitle">一个账号，多种身份。登录一次，协作无间。</p><form onSubmit={submit}>
        <label className="work-role-field">选择演示账号<select value={accountId} onChange={e => { setAccountId(e.target.value as DemoAccount['id']); setConsent(false); setError('') }}>{demoAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <div className="work-role-summary" aria-live="polite"><h3>此账号拥有 {account.roles.length} 个演示身份</h3><p>{account.roles.map(id => getRole(id)?.name).join(' / ')}</p><p>进入后可切换身份，无须重复登录。</p></div>
        <label className="work-consent"><input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setError('') }}/><span>我知道这是演示账号，不代表真实业务权限</span></label>
        {error ? <p className="work-error" role="alert">{error}</p> : null}{warning ? <p className="work-error" role="status">{warning}</p> : null}
        <button className="work-enter" type="submit">登录演示账号</button><button className="work-formal" type="button" disabled>正式登录（待接入）</button>
        <p className="work-disclaimer">不采集手机号，不发送验证码。演示身份仅在本机生效；正式权限由服务端核验。</p>
      </form></section></main><footer className="work-footer"><span>乡桥农业有限公司</span><span>生产端不收平台服务费</span></footer>
  </div>
}
