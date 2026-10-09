import { lazy, Suspense, useEffect } from 'react'
import { BrandLockup } from '../brand/BrandLockup'
import { Link, useLocation } from 'react-router-dom'
import Explore from './Explore'
import ParcelDetail from './ParcelDetail'
import IntentForm from './IntentForm'
import MyFarm from './MyFarm'
import { farmDescription, farmTitle, findPlot, isFarmPreviewPath } from './site'
import { useFarmDemo } from './useFarmDemo'
import './cloudfarm.css'
import { SupportCenter } from '../support/SupportCenter'
import { connectedMode } from '../connected/client'
const PublicProducts = lazy(() => import('../value/PublicProducts'))

export default function CloudFarmSite() {
  return connectedMode ? <main className="work-unavailable"><BrandLockup context="乡桥农场"/><h1>真实云农场暂未开放</h1><p>本地数据库模式不展示演示地块为已安装摄像头的真实地块。摄像头接入、公开授权和真实合同仍待实现。</p><a href="/">返回当前站点</a></main> : <DemoCloudFarmSite/>
}
function DemoCloudFarmSite() {
  const { pathname, search } = useLocation()
  const base = isFarmPreviewPath(pathname) ? '/cloud-preview' : ''
  const path = pathname.slice(base.length) || '/'
  const products = path === '/' && new URLSearchParams(search).get('view') === 'products'
  const demo = useFarmDemo()
  const match = /^\/plots\/([a-z0-9-]+)(\/apply)?\/?$/.exec(path)
  const plot = match && findPlot(match[1])
  useEffect(() => {
    const oldTitle = document.title
    const meta = document.querySelector('meta[name="description"]')
    const previous = meta?.getAttribute('content')
    document.title = farmTitle; meta?.setAttribute('content', farmDescription)
    return () => { document.title = oldTitle; if (previous != null) meta?.setAttribute('content', previous) }
  }, [])
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [pathname, search])
  return <div className="cf-site"><a className="cf-skip" href="#farm-main">跳至主要内容</a><header className="cf-header"><div className="cf-wrap"><Link className="cf-brand" to={base || '/'} aria-label="乡桥农场首页"><BrandLockup context="乡桥农场" domain="nc.nong.cloud"/></Link><nav aria-label="农场导航"><Link className={!products && (path === '/' || path.startsWith('/plots/')) ? 'active' : ''} aria-current={!products && (path === '/' || path.startsWith('/plots/')) ? 'page' : undefined} to={base || '/'}>农场列表</Link><Link className={products ? 'active' : ''} aria-current={products ? 'page' : undefined} to={`${base || '/'}?view=products`}>产品履历</Link><Link className={path === '/my-farm' ? 'active' : ''} aria-current={path === '/my-farm' ? 'page' : undefined} to={`${base}/my-farm`}>我的农场</Link><Link className={path === '/help' ? 'active' : ''} aria-current={path === '/help' ? 'page' : undefined} to={`${base}/help`}>帮助中心</Link><a href="https://nong.cloud/#platform">乡桥官网</a></nav></div></header>
    <main className="cf-wrap cf-main" id="farm-main">{!demo.storageAvailable && <p role="status" className="cf-notice">本设备的浏览器储存不可用，演示数据仅在当前页面会话有效。</p>}{products ? <Suspense fallback={<p>正在打开产品履历…</p>}><PublicProducts helpPath={`${base}/help`}/></Suspense> : path === '/help' ? <SupportCenter owner={{accountId:'farm-visitor-demo',identityId:'consumer-demo',label:'农场访客（本机演示，非登录账号）'}}/> : path === '/' ? <Explore base={base}/> : path === '/my-farm' ? <MyFarm key={path} base={base} demo={demo}/> : plot ? match[2] ? <IntentForm key={plot.id} plot={plot} base={base} demo={demo}/> : <ParcelDetail key={plot.id} plot={plot} base={base} demo={demo}/> : <section className="cf-empty"><h1>没有找到这个地块</h1><p>该地址不属于当前公开演示地块。</p><Link className="cf-button" to={base || '/'}>返回农场列表</Link></section>}</main>
    <footer className="cf-footer"><div className="cf-wrap"><Link className="cf-brand" to={base || '/'} aria-label="乡桥农场"><BrandLockup reverse context="乡桥农场" domain="nc.nong.cloud"/></Link><p>乡桥农业有限公司 · 演示数据仅保存在本设备</p></div></footer>
  </div>
}
