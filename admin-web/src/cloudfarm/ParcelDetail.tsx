import { useState } from 'react'
import { ArrowLeft, Camera } from 'lucide-react'
import { Link } from 'react-router-dom'
import { farmAsset, type FarmPlot } from './site'
import { DemoNotice, RecordTimeline, SectionTabs } from './ui'
import type { FarmDemo } from './useFarmDemo'

export default function ParcelDetail({ plot, base, demo }: { plot: FarmPlot; base: string; demo: FarmDemo }) {
  const [media, setMedia] = useState(0)
  const [tab, setTab] = useState(0)
  const favorite = demo.favorites.includes(plot.id)
  return <>
    <Link className="cf-back" to={base || '/'}><ArrowLeft size={18}/>返回农场列表</Link><h1>{plot.name}</h1><p className="cf-subtitle">{plot.location} · {plot.crop} · 面积待核验</p><DemoNotice/>
    <div className="cf-detail-layout"><section className="cf-media" aria-label="地块影像"><SectionTabs labels={['产地影像', '摄像头']} selected={media} onChange={setMedia} name="地块媒体" id="media"/><div id="media-panel" role="tabpanel" aria-labelledby={`media-tab-${media}`} tabIndex={0}>{media === 0 ? <figure><img src={farmAsset(plot.image)} alt={`${plot.name}资料照片，非实时摄像头画面`} width="1600" height="1065"/><figcaption>场景照片，非实时画面</figcaption></figure> : <div className="cf-camera-empty"><Camera size={44} strokeWidth={1.5}/><h3>摄像头尚未接入</h3><p>{plot.cameraConfigured ? '本地块仅展示镜头配置示例，当前没有直播视频。' : '本地块为未配置镜头的场景示例。'}</p><button className="cf-outline" type="button" onClick={() => setMedia(0)}>查看产地影像</button></div>}</div></section>
      <aside className="cf-plan"><h2>季节认购方案（示例）</h2><dl><div><dt>地块面积</dt><dd>待核验</dd></div><div><dt>预计收获</dt><dd>待核验</dd></div><div><dt>方案价格</dt><dd>待确认</dd></div></dl><Link className="cf-button" to={`${base}/plots/${plot.id}/apply`}>申请签约（演示）</Link><button className="cf-outline" type="button" aria-pressed={favorite} onClick={() => demo.toggleFavorite(plot.id)}>{favorite ? '已关注 · 取消关注' : '加入关注'}</button><p className="cf-muted cf-caption">仅体验流程，不形成正式合同，不收款。</p></aside>
    </div>
    <section className="cf-detail-records"><SectionTabs labels={['农事记录', '地块档案', '认养方案']} selected={tab} onChange={setTab} name="地块详情" id="detail"/><div role="tabpanel" id="detail-panel" aria-labelledby={`detail-tab-${tab}`} tabIndex={0}>{tab === 0 ? <RecordTimeline/> : tab === 1 ? <div className="cf-info"><h2>地块档案（示例）</h2><dl><div><dt>作物</dt><dd>{plot.crop}</dd></div><div><dt>位置</dt><dd>{plot.location}</dd></div><div><dt>面积、海拔与种植年限</dt><dd>待测绘与核验</dd></div><div><dt>土壤检测与施肥建议</dt><dd>检测机构资料待接入</dd></div></dl><p>不以资料照片替代地块位置、面积和生产记录的真实核验。</p></div> : <div className="cf-info"><h2>认养方案（示例）</h2><p>产品价款、收获量、交付时间、质量标准与履约责任待双方确认。消费者不收平台服务费，实际产品价款另行约定。</p><p>本演示申请只保存于此设备，不代表合同签署、地块占用或供货承诺。</p><Link className="cf-text-link" to={`${base}/plots/${plot.id}/apply`}>体验签约申请</Link></div>}</div></section>
  </>
}
