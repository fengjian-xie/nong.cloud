import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { farmAsset, findPlot } from './site'
import { DemoNotice, GrowthTimeline, SectionTabs } from './ui'
import type { FarmDemo } from './useFarmDemo'

export default function MyFarm({ base, demo }: { base: string; demo: FarmDemo }) {
  const { search } = useLocation()
  const [tab, setTab] = useState(() => new URLSearchParams(search).get('tab') === 'applications' ? 1 : 0)
  const [confirmClear, setConfirmClear] = useState(false)
  const favorites = demo.favorites.flatMap(id => { const plot = findPlot(id); return plot ? [plot] : [] })
  return <>
    <h1>我的农场</h1><p className="cf-subtitle">关注地块、查看签约申请、跟踪每一段生长。</p><DemoNotice/>
    <SectionTabs labels={['关注地块', '签约申请']} selected={tab} onChange={setTab} name="我的农场" id="my-farm"/>
    <div role="tabpanel" id="my-farm-panel" aria-labelledby={`my-farm-tab-${tab}`} tabIndex={0}>{tab === 0 ? favorites.length ? favorites.map(plot => <article className="cf-followed" key={plot.id}><img className="cf-followed-photo" src={farmAsset(plot.image)} alt={`${plot.name}场景资料照片`} width="1600" height="1065"/><div><div className="cf-followed-heading"><div><h2>{plot.name}</h2><p className="cf-muted">{plot.location}</p></div><div className="cf-row-actions"><Link className="cf-button" to={`${base}/plots/${plot.id}`}>查看地块</Link><button className="cf-outline" type="button" onClick={() => demo.toggleFavorite(plot.id)}>取消关注</button></div></div><GrowthTimeline/></div></article>) : <div className="cf-empty"><h2>还没有关注地块</h2><p>浏览地块并点击“加入关注”，即可在此跟踪示例动态。</p><Link className="cf-button" to={base || '/'}>浏览农场</Link></div> : demo.intents.length ? <div className="cf-applications">{demo.intents.map(intent => <article className="cf-application" key={intent.id}><div><h2>{findPlot(intent.plotId)?.name}</h2><p>{intent.alias} · {intent.quantity}份 · {intent.delivery}</p><p className="cf-muted cf-caption">演示提交时间：{new Date(intent.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p></div><div><p className="cf-intent-status">已保存（演示）</p><p className="cf-caption cf-muted">仅保存到本设备，未发送给任何商家，不构成合同。</p><div className="cf-row-actions"><Link className="cf-text-link" to={`${base}/plots/${intent.plotId}`}>查看地块</Link><button className="cf-outline" type="button" onClick={() => demo.cancelIntent(intent.id)}>撤回演示申请</button></div></div></article>)}</div> : <div className="cf-empty"><h2>还没有演示申请</h2><p>从地块详情进入签约申请，体验不收款、不形成真实合同的流程。</p><Link className="cf-button" to={base || '/'}>浏览农场</Link></div>}</div>
    <div className="cf-local-data"><p>演示数据仅保存在本设备，不跨设备同步，不代替正式签约。</p>{confirmClear ? <div role="group" aria-label="清空演示数据确认"><span>清空此设备的关注和申请？</span><button type="button" className="cf-outline" onClick={() => { demo.clearDemo(); setConfirmClear(false) }}>确认清空</button><button type="button" className="cf-text-link" onClick={() => setConfirmClear(false)}>保留数据</button></div> : <button type="button" className="cf-text-link" onClick={() => setConfirmClear(true)}>清空本设备演示数据</button>}</div>
  </>
}
