import { useState } from 'react'
import { Camera, EyeOff, Grape, LandPlot, MapPin, Search, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { farmAsset, filterPlots } from './site'
import { DemoNotice } from './ui'

export default function Explore({ base }: { base: string }) {
  const [search, setSearch] = useState('')
  const [crop, setCrop] = useState('')
  const [camera, setCamera] = useState('')
  const results = filterPlots(search, crop, camera)
  return <>
    <section className="cf-explore-heading"><div><h1 aria-label="看见田间，选择你的云农场。">看见田间，<wbr/><span className="cf-title-phrase">选择你的云农场。</span></h1><p className="cf-subtitle">浏览地块与农事记录，了解认养方案，跟踪一季生长。</p><DemoNotice/></div><img src={farmAsset('fuan-farm-aerial-v1.jpg')} alt="用户提供的福安农场航拍资料照片，非实时画面" width="1920" height="1080"/></section>
    <form className="cf-filters" role="search" onSubmit={event => event.preventDefault()}><label className="cf-search"><Search size={20}/><input aria-label="搜索地块或作物" placeholder="搜索地块或作物" value={search} onChange={event => setSearch(event.target.value)}/></label><select aria-label="筛选作物" value={crop} onChange={event => setCrop(event.target.value)}><option value="">全部作物</option><option value="葡萄">葡萄</option></select><select aria-label="筛选镜头配置" value={camera} onChange={event => setCamera(event.target.value)}><option value="">全部镜头配置</option><option value="configured">镜头配置示例</option><option value="none">未配置镜头（示例）</option></select></form>
    <section aria-labelledby="cf-list-title"><div className="cf-list-heading"><h2 id="cf-list-title">可浏览地块</h2><p className="cf-muted" aria-live="polite">{results.length}个场景示例</p></div><div className="cf-plot-list">{results.map(plot => <article className="cf-plot-row" key={plot.id}>
      <Link to={`${base}/plots/${plot.id}`} aria-label={`查看${plot.name}`}><img src={farmAsset(plot.image)} alt={`${plot.name}场景资料照片，非实时画面`} width="1600" height="1065" loading="lazy"/></Link><div className="cf-plot-copy"><h3>{plot.name}</h3><p className="cf-plot-meta"><span><MapPin size={18}/>{plot.location}</span><span><Grape size={18}/>{plot.crop}</span><span><LandPlot size={18}/>面积待核验</span></p><p className="cf-camera-status">{plot.cameraConfigured ? <Camera size={19}/> : <EyeOff size={19}/>} {plot.cameraConfigured ? '镜头配置示例 · 直播待接入' : '未配置镜头（示例）'}</p></div><Link className="cf-button" to={`${base}/plots/${plot.id}`}>查看地块<ArrowRight size={18}/></Link>
    </article>)}</div>{results.length === 0 && <div className="cf-empty"><h3>没有匹配的演示地块</h3><p>试试其他关键词，或恢复全部筛选。</p><button type="button" className="cf-outline" onClick={() => { setSearch(''); setCrop(''); setCamera('') }}>清除筛选</button></div>}</section>
  </>
}
