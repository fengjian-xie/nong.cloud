import { ArrowLeft, Check, FileImage, FileVideo, ImagePlus, MapPin, Mountain, Navigation, Trash2, UploadCloud, X } from 'lucide-react'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { decide, deletePlotMedia, getPlot, getPlotMedia, getPlotPurchases, savePlotMedia } from '../api/mock'
import { StatusChip } from '../components/StatusChip'
import type { OperationRow, PlotMedia, PlotPurchase } from '../types'

const readFile = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) })
const formatSize = (size: number) => size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`

export function PlotDetailPage() {
  const { plotId = '' } = useParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const [plot, setPlot] = useState<OperationRow | null>(null)
  const [media, setMedia] = useState<PlotMedia[]>([])
  const [purchases, setPurchases] = useState<PlotPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getPlot(plotId), getPlotMedia(plotId), getPlotPurchases(plotId)]).then(([plotResponse, mediaResponse, purchaseResponse]) => { if (active) { setPlot(plotResponse.data); setMedia(mediaResponse.data); setPurchases(purchaseResponse.data) } }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : '加载失败') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [plotId])

  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(''), 2000) }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files || [])]; event.target.value = ''
    if (!files.length) return
    if (media.length + files.length > 9) return notify('每个地块最多上传9个文件')
    const invalid = files.find((file) => !file.type.startsWith('image/') && !file.type.startsWith('video/'))
    if (invalid) return notify('仅支持图片和视频')
    const tooLarge = files.find((file) => file.size > (file.type.startsWith('video/') ? 100 : 10) * 1024 * 1024)
    if (tooLarge) return notify(`${tooLarge.name} 超出大小限制`)
    setUploading(true)
    try { const saved = await Promise.all(files.map(async (file) => savePlotMedia(plotId, { name: file.name, kind: file.type.startsWith('video/') ? 'video' : 'image', size: file.size, url: await readFile(file) }))); setMedia((current) => [...saved.map((item) => item.data), ...current]); notify(`已上传${saved.length}个文件`) } catch { notify('上传失败，请重试') } finally { setUploading(false) }
  }
  async function remove(item: PlotMedia) { await deletePlotMedia(plotId, item.id); setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id)); notify('附件已删除') }
  async function verify(action: 'verify' | 'reject') { if (!plot) return; const { data } = await decide('plots', String(plot.id), action); setPlot({ ...plot, status: data.status }); notify(action === 'verify' ? '地块核验已通过' : '地块核验已驳回') }

  if (loading) return <div className="member-detail-loading">正在加载地块详情…</div>
  if (!plot || error) return <div className="error-state"><MapPin size={40}/><h1>地块不存在</h1><p>{error || '无法找到该地块'}</p><Link className="primary-inline" to="/plots">返回地块列表</Link></div>

  const linkedPendingHarvest = purchases.length ? `${purchases.reduce((sum, purchase) => sum + (Number.parseFloat(purchase.quantity) || 0), 0).toFixed(1)}吨` : String(plot.pendingHarvest || '0吨')

  return <div className="plot-detail-page">
    <div className="detail-breadcrumb"><Link to="/plots"><ArrowLeft size={16}/>地块核验列表</Link><span>/</span><strong>{String(plot.name)}</strong><Link className="farm-link" to={`/production?plot=${plotId}`}>产季档案 / 农事记录 →</Link></div>
    <header className="plot-profile-head"><div><span>地块编号 {String(plot.id)}</span><h1>{String(plot.name)}</h1><p><MapPin size={14}/>{String(plot.town)} · 所有者 {String(plot.owner)}</p></div><StatusChip>{String(plot.status)}</StatusChip></header>
    <div className="plot-detail-layout"><main>
      <section className="panel plot-base-panel"><div className="panel-head"><div><h2>地块基础信息</h2><p>核验面积、海拔、位置与采集来源</p></div></div><div className="plot-key-metrics"><div><span>面积</span><strong>{String(plot.area)}</strong></div><div><span>作物</span><strong>{String(plot.crop)}</strong></div><div><span>预计产量</span><strong>{String(plot.estimatedYield)}</strong></div></div><dl className="plot-data"><div><dt>所在地</dt><dd>{String(plot.town)}</dd></div><div><dt>所有者</dt><dd>{String(plot.owner)}</dd></div><div><dt>上市时间</dt><dd>{String(plot.harvestStart)}</dd></div><div><dt>待采数量</dt><dd><strong className="pending-harvest">{linkedPendingHarvest}</strong><small className="linked-data-note">采购关系采购量合计</small></dd></div><div><dt>经度</dt><dd>{String(plot.longitude)}</dd></div><div><dt>纬度</dt><dd>{String(plot.latitude)}</dd></div><div><dt>采集方式</dt><dd>{String(plot.collectionMethod)}</dd></div><div><dt>海拔</dt><dd>{String(plot.altitude)}</dd></div><div><dt>编号</dt><dd>{String(plot.id)}</dd></div><div><dt>核验状态</dt><dd><StatusChip>{String(plot.status)}</StatusChip></dd></div></dl></section>
      <section className="panel plot-purchase-panel"><div className="panel-head"><div><h2>采购关系</h2><p>展示谁在什么时间采购了该地块的多少货品</p></div><span className="settings-count">{purchases.length} 笔</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>采购单号</th><th>采购方</th><th>采购时间</th><th>作物</th><th>采购量</th><th>状态</th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id}><td><code>{purchase.id}</code></td><td><strong>{purchase.buyer}</strong></td><td>{purchase.purchasedAt}</td><td>{purchase.product}</td><td><strong className="harvest-yield">{purchase.quantity}</strong></td><td><StatusChip>{purchase.status}</StatusChip></td></tr>)}</tbody></table></div></section>
      <section className="panel plot-media-panel"><div className="panel-head"><div><h2>地块图片与视频</h2><p>用于核验边界、作物现状和现场环境</p></div><span className="settings-count">{media.length}/9</span></div><div className="plot-upload-zone" onClick={() => inputRef.current?.click()}><input ref={inputRef} type="file" accept="image/*,video/*" multiple onChange={upload}/><UploadCloud size={30}/><strong>{uploading ? '正在上传…' : '上传图片或视频'}</strong><span>可多选或点击此区域；图片≤10MB，视频≤100MB</span><button className="secondary-button" disabled={uploading}><ImagePlus size={15}/>选择文件</button></div>{media.length ? <div className="plot-media-grid">{media.map((item) => <article key={item.id}>{item.kind === 'image' ? <img src={item.url} alt={item.name}/> : <video src={item.url} controls preload="metadata"/>}<div><span>{item.kind === 'image' ? <FileImage size={14}/> : <FileVideo size={14}/>}<strong>{item.name}</strong></span><small>{formatSize(item.size)} · {item.uploadedAt}</small></div><button aria-label={`删除${item.name}`} onClick={() => remove(item)}><Trash2 size={15}/></button></article>)}</div> : <div className="plot-media-empty"><FileImage size={28}/><span>暂未上传现场图片或视频</span></div>}</section>
    </main><aside>
      <section className="panel plot-location-panel"><div className="panel-head"><div><h2>定位信息</h2><p>采集坐标与海拔</p></div></div><div className="plot-map-preview"><Navigation size={30}/><strong>{String(plot.town)}</strong><span>{String(plot.longitude)}, {String(plot.latitude)}</span></div><div className="location-stat"><Mountain size={18}/><span><small>海拔</small><strong>{String(plot.altitude)}</strong></span></div></section>
      <section className="panel audit-panel"><h2>地块核验</h2><p>核验结果将同步给地块所有者。</p><textarea placeholder="填写边界、面积或影像核验说明"/><div><button className="secondary-button danger-text" onClick={() => verify('reject')}><X size={16}/>驳回</button><button className="primary-inline" onClick={() => verify('verify')}><Check size={16}/>核验通过</button></div></section>
    </aside></div>
    {toast ? <div className="toast"><Check size={16}/>{toast}</div> : null}
  </div>
}
