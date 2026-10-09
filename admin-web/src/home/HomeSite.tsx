import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowRight, ArrowUpRight, Menu, X } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { businesses, cloudFarmEntryReady, homeAsset, homeDescription, homeTitle, isHomePreviewPath, platformEntries } from './site'
import { CardSection } from './CardSection'
import { MembersSection } from './MembersSection'
import { StandardsSection } from './StandardsSection'
import { NewsSection } from './NewsSection'
import { SocialLinks } from './SocialLinks'
import { ProductValueSection } from './ProductValueSection'
import { farmerFeePolicy } from '../pricing'
import { BrandLockup } from '../brand/BrandLockup'
import './home.css'

export default function HomeSite() {
  const { pathname, hash, search } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeBusiness, setActiveBusiness] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const home = isHomePreviewPath(pathname) ? '/home-preview' : '/'
  const socialCenter = isHomePreviewPath(pathname) ? new URLSearchParams(search).get('center') || 'platform' : 'platform'
  const business = businesses[activeBusiness]

  useEffect(() => {
    const previousTitle = document.title
    const meta = document.querySelector('meta[name="description"]')
    const previousDescription = meta?.getAttribute('content')
    document.title = homeTitle
    meta?.setAttribute('content', homeDescription)
    return () => {
      document.title = previousTitle
      if (previousDescription != null) meta?.setAttribute('content', previousDescription)
    }
  }, [])

  useEffect(() => {
    if (['#main', '#platform', '#business', '#fuan', '#about', '#card', '#members', '#join', '#standards', '#news', '#social', '#product-value'].includes(hash)) document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' })
  }, [hash])

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % businesses.length
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + businesses.length - 1) % businesses.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = businesses.length - 1
    else return
    event.preventDefault()
    setActiveBusiness(next)
    tabRefs.current[next]?.focus()
  }

  if (!['/', '/home-preview', '/home-preview/'].includes(pathname)) return <Navigate to={home} replace/>

  return <div className="xq-home">
    <a className="xq-skip" href="#main">跳转至主内容</a>
    <header className="xq-header">
      <div className="xq-wrap xq-header-inner">
        <a href={home} className="xq-brand" aria-label="乡桥农事中心首页"><BrandLockup context="乡桥农事中心" domain="nong.cloud"/></a>
        <button className="xq-menu-toggle" type="button" aria-label={menuOpen ? '关闭导航' : '打开导航'} aria-expanded={menuOpen} aria-controls="xq-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
        <nav id="xq-navigation" aria-label="官网导航" className={menuOpen ? 'xq-nav xq-nav-open' : 'xq-nav'} onKeyDown={event => { if (event.key === 'Escape') setMenuOpen(false) }}>
          <a href="#platform" onClick={() => setMenuOpen(false)}>平台入口</a>
          <a href="#business" onClick={() => setMenuOpen(false)}>业务介绍</a>
          <a href="#card" onClick={() => setMenuOpen(false)}>农事卡</a>
          <a href="#product-value" onClick={() => setMenuOpen(false)}>产品价值</a>
          <a href="#members" onClick={() => setMenuOpen(false)}>成员与申请</a>
          <a href="#standards" onClick={() => setMenuOpen(false)}>执行标准</a>
          <a href="#news" onClick={() => setMenuOpen(false)}>新闻动态</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>关于乡桥</a>
          <a href="https://api.nong.cloud/">开放平台<ArrowUpRight size={14}/></a>
          <a className="xq-outline-button" href="https://m.nong.cloud/">后台演示<ArrowUpRight size={14}/></a>
        </nav>
      </div>
    </header>

    <main id="main">
      <section className="xq-wrap xq-hero" aria-labelledby="hero-title">
        <div className="xq-hero-copy">
          <h1 id="hero-title">让农事有记录，<br/>让好产品被看见。</h1>
          <p>乡桥连接种植户、合作社、农服机构与采购商。<br className="xq-desktop-break"/>从一张农事卡开始，让生产可记录、好产品可追溯。</p>
          <div className="xq-actions"><a className="xq-solid-button" href="#business">了解乡桥业务<ArrowRight size={18}/></a><a className="xq-text-button" href="#about">关于我们<ArrowRight size={18}/></a></div>
        </div>
        <figure className="xq-hero-photo"><img src={homeAsset('fuan-grapes.jpg')} alt="福安葡萄特写，用户提供的产区资料照片" width="1280" height="850" loading="eager"/><figcaption>福安葡萄 · 产区影像</figcaption></figure>
      </section>

      <section className="xq-mission"><div className="xq-wrap"><h2>扎根产业带，服务小农户。</h2><p>不向农户收平台服务费，把服务做在田间，把价值留给种植者。</p></div></section>

      <section id="platform" className="xq-wrap xq-section xq-platform" aria-labelledby="platform-title">
        <div className="xq-section-heading"><h2 id="platform-title">从这里，进入乡桥。</h2><p>生产、服务、采购与消费，让不同角色找到自己的入口。</p></div>
        <div className="xq-platform-list">{platformEntries.map((entry, index) => <article className="xq-platform-row" key={entry.name}>
          <div className="xq-platform-name"><span>0{index + 1}</span><div><h3>{entry.name}</h3><small>{entry.domain}</small></div></div>
          <div className="xq-platform-copy"><p>{entry.description}</p><small>{entry.status}</small></div>
          <a href={entry.href} target={entry.href.startsWith('https:') ? '_blank' : undefined} rel={entry.href.startsWith('https:') ? 'noopener noreferrer' : undefined} className="xq-text-button" onClick={() => { if ('business' in entry) setActiveBusiness(entry.business) }}>{entry.action}{entry.href.startsWith('https:') ? <ArrowUpRight size={17}/> : <ArrowRight size={17}/>}</a>
        </article>)}</div>
      </section>

      <section id="business" className="xq-wrap xq-section" aria-labelledby="business-title">
        <div className="xq-section-heading"><h2 id="business-title">从生产记录，到产销协同。</h2><p>以真实记录为基础，让每一方找到自己的连接方式。</p></div>
        <div className="xq-business-layout">
          <div className="xq-business-tabs" role="tablist" aria-label="乡桥业务" aria-orientation="vertical">
            {businesses.map((item, index) => <button key={item.name} ref={element => { tabRefs.current[index] = element }} id={`business-tab-${index}`} role="tab" type="button" aria-selected={activeBusiness === index} aria-controls="business-panel" tabIndex={activeBusiness === index ? 0 : -1} onClick={() => setActiveBusiness(index)} onKeyDown={event => handleTabKey(event, index)}><span>0{index + 1}</span>{item.name}<ArrowRight size={18}/></button>)}
          </div>
          <div id="business-panel" role="tabpanel" aria-labelledby={`business-tab-${activeBusiness}`} tabIndex={0} className="xq-business-panel">
            <h3>{business.title}</h3><p>{business.description}</p><p className="xq-status">{business.status}</p>
            <img className="xq-business-photo" src={homeAsset(business.image)} alt={business.alt} width="1920" height="640" loading="lazy"/>
            <ol className="xq-flow">{business.steps.map((step, index) => <li key={step}><span>0{index + 1}</span>{step}{index < business.steps.length - 1 && <ArrowRight size={14} aria-hidden="true"/>}</li>)}</ol>
            <h4>{business.detailTitle}</h4><p className="xq-detail-copy">{business.detail}</p>
            {activeBusiness === 2 && cloudFarmEntryReady && <a className="xq-text-button xq-cloud-entry" href="https://nc.nong.cloud/">打开乡桥农场<ArrowUpRight size={17}/></a>}
          </div>
        </div>
        <div className="xq-fee-policy"><h3>农户免平台服务费，农事卡按张收费。</h3><p>{farmerFeePolicy}卡片费用不属于平台服务费。</p><p>消费者认购不收平台服务费，实际产品价款另行约定；商业端探索采购信息服务、商家服务、授权数据服务及合作社产品购销。数据服务以合法授权、必要使用为前提，不出售个人隐私。</p><a className="xq-text-button" href="https://api.nong.cloud/">了解开放接口<ArrowUpRight size={16}/></a></div>
      </section>

      <CardSection/>
      <ProductValueSection preview={isHomePreviewPath(pathname)}/>
      <MembersSection/>
      <StandardsSection/>
      <NewsSection key={home} preview={isHomePreviewPath(pathname)}/>

      <section id="fuan" className="xq-origin" aria-labelledby="origin-title"><div className="xq-wrap">
        <div className="xq-section-heading"><h2 id="origin-title">一串葡萄，连接一片土地。</h2><p>从福安葡萄产业带出发，看见产地，也看见人与土地的连接。</p></div>
        <figure className="xq-panorama"><img src={homeAsset('fuan-panorama.jpg')} alt="福安葡萄产业带的山水和连片大棚全景" width="1920" height="960" loading="lazy"/><figcaption>福安葡萄产业带 · 资料图片</figcaption></figure>
        <div className="xq-origin-gallery">
          <figure><img src={homeAsset('fuan-experience-1.jpg')} alt="产地体验资料照片：游客手持葡萄" width="1280" height="882" loading="lazy"/><figcaption>从产地，感受一季的收获</figcaption></figure>
          <figure><img src={homeAsset('fuan-experience-2.jpg')} alt="产地体验资料照片：游客品尝葡萄" width="1280" height="852" loading="lazy"/><figcaption>好风味，是连接的开始</figcaption></figure>
          <figure><img src={homeAsset('fuan-experience-3.jpg')} alt="产地体验资料照片：游客展示一串葡萄" width="1280" height="903" loading="lazy"/><figcaption>让好产品，被更多人看见</figcaption></figure>
        </div>
        <details className="xq-origin-details"><summary>查看更多产区环境影像<ArrowRight size={16}/></summary><figure><img src={homeAsset('fuan-landscape.jpg')} alt="用户提供的产区环境资料照片，画面包含农业示范区石碑" width="1600" height="1065" loading="lazy"/><figcaption>产区环境资料图片，不作为乡桥项目资质或官方认定证明。</figcaption></figure></details>
        <p className="xq-image-note">以上影像由项目发起方提供，仅展示产区与体验场景，不代表乡桥试点已完成建设。</p>
      </div></section>

      <section id="about" className="xq-wrap xq-section xq-company" aria-labelledby="about-title">
        <div className="xq-company-image" aria-hidden="true"><img src={homeAsset('fuan-vineyard.jpg')} alt="" loading="lazy"/></div>
        <div className="xq-section-heading"><h2 id="about-title">一家从田间出发的公司。</h2><p>乡桥围绕农业产业带，连接小农户、合作社、服务机构与采购商，<br className="xq-desktop-break"/>让真实的生产记录成为信任和协作的基础。</p></div>
        <div className="xq-company-columns"><div><span>平台主体</span><h3>乡桥农业有限公司</h3><p>负责平台产品、记录体系、产销协同与开放接口建设。nong.cloud 为乡桥农事中心首页，nc.nong.cloud 面向消费者，work.nong.cloud 面向产业主体。配套小程序统一使用“乡桥”。</p></div><div><span>福安服务中心主体</span><h3>福安市乡桥农事综合服务有限公司</h3><p>拟以赛岐镇狮子头村为试点，建设福安市农事综合服务中心，提供农事采集、农资农服协同与土壤检测对接。</p></div></div>
      </section>

      <section className="xq-roadmap" aria-labelledby="roadmap-title"><div className="xq-wrap"><div className="xq-section-heading"><h2 id="roadmap-title">先在福安扎根，再让模式生长。</h2><p>以下为建设规划，不代表已完成覆盖或获得认证。</p></div><ol>
        <li><span>01</span><h3>建立样板</h3><p>计划覆盖福安葡萄500亩；以赛岐镇狮子头村为试点，先做20个工程样机，验证采集与服务流程。</p></li>
        <li><span>02</span><h3>连接产业</h3><p>计划服务1000个用户，推进1000张农事卡试用，逐步接入摄像头与环境传感器，并探索授权溯源平台对接。</p></li>
        <li><span>03</span><h3>复制模式</h3><p>目标拓展至10000张农事卡，在经过验证的基础上，向其他农业产业带复制可持续的服务模式。</p></li>
      </ol></div></section>

      <section className="xq-cta"><div className="xq-wrap"><h2>让一季耕耘，被更多人看见。</h2><div className="xq-actions"><a href="#join">准备加入申请<ArrowRight size={18}/></a><a href="https://api.nong.cloud/">查看开放平台<ArrowUpRight size={18}/></a></div><p>当前提供管理后台、主体工作台、农场与API文档演示；真实设备、授权与交易分阶段接入。</p></div></section>
    </main>

    <footer id="social" className="xq-footer"><div className="xq-wrap">
      <div className="xq-footer-top"><a className="xq-brand" href={home} aria-label="乡桥农事中心"><BrandLockup reverse context="乡桥农事中心" domain="nong.cloud"/></a><nav aria-label="页脚导航"><a href="#join">准备加入</a><a href="#standards">准入与验收</a><a href="#news">新闻动态</a><a href="#about">关于乡桥</a><a href={homeAsset('xiangqiao-vi-lockup.svg')} download>下载乡桥农业LOGO</a></nav></div>
      <SocialLinks key={`${home}:${socialCenter}`} preview={isHomePreviewPath(pathname)} centerId={socialCenter}/>
      <p>乡桥农业有限公司 · 农事记录核验不替代法定认证；授权数据不等于个人数据售卖。品牌视觉遵循乡桥农业VI手册V1.0。</p>
    </div></footer>
  </div>
}
