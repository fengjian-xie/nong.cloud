import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PassportSummary } from './PassportSummary'
import { publicPassportDemo } from './model'
import './value.css'

export default function PublicProducts({ helpPath }: { helpPath: string }) {
  const [tab, setTab] = useState('passport'), [followed, setFollowed] = useState(false), [feedback, setFeedback] = useState(''), [saved, setSaved] = useState('')
  return <section className="cf-product-hub value-page"><div className="cf-section-title"><span>PRODUCT PASSPORT</span><h1>让产品，有一份可看的经历。</h1><p>产品履历、供货预告和交付反馈；当前全部为公开流程示例。</p></div>
    <nav className="value-nav" aria-label="消费者产品模块">{[{ id: 'passport', title: '产品履历' }, { id: 'calendar', title: '采收预告' }, { id: 'feedback', title: '交付反馈' }].map(t => <button className={`cf-button ${tab === t.id ? '' : 'cf-button-light'}`} key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.title}</button>)}</nav>
    <div className="cf-notice">公开最小摘要，不读取农户私人成本、卡号、定位或后台草稿。本机操作不形成订单、付款、通知或官方认证。</div>
    {tab === 'passport' ? <div className="cf-panel"><PassportSummary summary={publicPassportDemo}/><p>批次二维码与实物绑定待接入；不使用假二维码证明真实溯源。</p></div> : null}
    {tab === 'calendar' ? <div className="cf-panel"><h2>福安葡萄采收预告（示例）</h2><p>品种、预计成熟窗口和可供量待经营主体确认。没有实时货源，不展示虚构“今天可认购库存”。</p><button className="cf-button" onClick={() => setFollowed(!followed)}>{followed ? '取消本页关注' : '关注采收预告示例'}</button>{followed ? <p role="status">本页关注已保存到当前页面状态，刷新不保留；未发送提醒或认购请求。</p> : null}</div> : null}
    {tab === 'feedback' ? <div className="cf-panel"><h2>交付反馈草稿</h2><form className="cf-form" onSubmit={e => { e.preventDefault(); setSaved(feedback.trim()); setFeedback('') }}><label>批次与交付情况（仅测试）<textarea required minLength={8} maxLength={600} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="测试说明，不填写真实联系方式；未核验的反馈不会公开评分"/></label><button className="cf-button">保存本页反馈草稿</button></form>{saved ? <p role="status">草稿：{saved}。只在本页，不送达经营主体、不自动退款；刷新后不保留。</p> : null}<Link to={helpPath}>进入帮助中心 →</Link></div> : null}
    <p className="cf-fine-print">认购价格、份额、减产、配送及售后须明确约定；消费者免平台服务费，不代表产品或运费免费。</p>
  </section>
}
