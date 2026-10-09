import { useState, type FormEvent } from 'react'
import { ArrowLeft, CircleCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { farmAsset, type FarmPlot } from './site'
import { deliveries, validAlias, type Delivery } from './storage'
import { DemoNotice } from './ui'
import type { FarmDemo } from './useFarmDemo'

export default function IntentForm({ plot, base, demo }: { plot: FarmPlot; base: string; demo: FarmDemo }) {
  const [alias, setAlias] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [delivery, setDelivery] = useState<Delivery>('待协商')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!consent) { setError('请先确认这是演示意向，不形成正式合同。'); return }
    if (!validAlias(alias)) { setError('仅填写不超过20字的演示称呼，请勿输入手机号、邮箱或真实身份信息。'); return }
    const count = Number(quantity)
    if (!Number.isInteger(count) || count < 1 || count > 10) { setError('演示认购份数为1至10的整数。'); return }
    if (demo.addIntent({ plotId: plot.id, alias: alias.trim() || '演示访客', quantity: count, delivery })) { setError(''); setSubmitted(true) }
  }
  if (submitted) return <section className="cf-success"><CircleCheck size={52} strokeWidth={1.4}/><h1>演示意向已保存</h1><p>{demo.storageAvailable ? '申请只保存到本设备，不构成合同、不产生费用。' : '本设备无法保存数据，申请仅在当前页面会话有效，不构成合同、不产生费用。'}</p><p>真实认购须在资料核验后，另行确认产品价款与履约条件。</p><Link className="cf-button" to={`${base}/my-farm?tab=applications`}>查看我的农场</Link><Link className="cf-text-link" to={`${base}/plots/${plot.id}`}>返回地块详情</Link></section>
  return <>
    <Link className="cf-back" to={`${base}/plots/${plot.id}`}><ArrowLeft size={18}/>返回地块详情</Link>
    <div className="cf-intent-layout"><section><h1>签约申请 · 场景演示</h1><p className="cf-subtitle">提交演示意向，体验认购流程。</p><DemoNotice/>
      <form className="cf-intent-form" onSubmit={submit} noValidate><label><span>认购方案</span><select aria-label="认购方案"><option>葡萄季节认购（示例）</option></select></label><label><span>演示称呼</span><input placeholder="请勿填写真实身份信息" autoComplete="off" maxLength={20} value={alias} onChange={event => setAlias(event.target.value)}/></label><label><span>认购份数</span><input type="number" min="1" max="10" step="1" inputMode="numeric" value={quantity} onChange={event => setQuantity(event.target.value)}/></label><label><span>交付偏好</span><select value={delivery} onChange={event => setDelivery(event.target.value as Delivery)}>{deliveries.map(value => <option key={value}>{value}</option>)}</select></label>
        <p className="cf-price-note">价格待确认，本次不收款。</p><label className="cf-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/><span>我知悉这只是演示意向，不形成正式合同</span></label>{error && <p className="cf-error" role="alert">{error}</p>}<button className="cf-button" type="submit">提交演示申请</button>
      </form></section><aside className="cf-intent-summary"><img src={farmAsset('fuan-grapes.jpg')} alt="福安葡萄场景资料照片" width="1280" height="850"/><h2>{plot.name}</h2><p>{plot.location}</p><p>产品价款与履约条件待双方确认。</p><img src={farmAsset('fuan-vineyard.jpg')} alt="福安葡萄产区航拍资料照片" width="1600" height="1065"/></aside></div>
  </>
}
