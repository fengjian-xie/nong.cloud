import { Camera, CreditCard, MapPin, Radio, Thermometer, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFarm } from './FarmProvider'
import { demoDate } from './model'
import { FarmPage, Modal, Panel, SearchField, Stats, Table, Tag } from './ui'

const points = [{ left: 24, top: 45 }, { left: 48, top: 68 }, { left: 73, top: 29 }, { left: 38, top: 22 }, { left: 79, top: 65 }, { left: 62, top: 48 }]
function AreaMap({ items, selected, onSelect }: { items: { id: string; label: string; detail: string }[]; selected: string; onSelect: (id: string) => void }) {
  return <div className="farm-area-map" aria-label="福安资源示意，不是真实地图"><div className="farm-map-river"/><div className="farm-map-road"/><div className="farm-map-title"><MapPin size={15}/>福安市 · 赛岐试点<span>布局示意 / 非真实地理坐标</span></div><span className="farm-map-village">狮子头村</span><span className="farm-map-region">赛岐镇</span><span className="farm-map-north">N ↑</span>{items.map((item, index) => <button key={item.id} className={`farm-map-pin ${selected === item.id ? 'selected' : ''}`} style={{ left: `${points[index % points.length].left}%`, top: `${points[index % points.length].top}%` }} onClick={() => onSelect(item.id)} aria-pressed={selected === item.id} aria-label={`查看${item.label}`}><span>{index + 1}</span><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div>
}

export function MaturityPage() {
  const { state } = useFarm()
  const [query, setQuery] = useState('')
  const [window, setWindow] = useState('全部')
  const [selectedId, setSelectedId] = useState(state.plots[0].id)
  const daysUntil = (date: string) => Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${demoDate}T00:00:00`).getTime()) / 86400000)
  const ready = state.plots.filter(p => !p.forecastPending)
  const rows = state.plots.filter(p => `${p.name}${p.crop}${p.town}`.includes(query.trim()) && (window === '全部' || !p.forecastPending && daysUntil(p.harvest) >= 0 && daysUntil(p.harvest) <= Number(window)))
  const selected = rows.find(p => p.id === selectedId) || rows[0]
  return <FarmPage title="产品成熟一览" description="回答哪里有货、什么时候熟、有多大规模；仅发布农户授权的供应信息">
    <Stats items={[{ label: '未来7天成熟', value: ready.filter(p => daysUntil(p.harvest) >= 0 && daysUntil(p.harvest) <= 7).length, detail: '按演示基准日计算' }, { label: '预测产量', value: `${(ready.reduce((s, p) => s + p.yieldKg, 0) / 1000).toFixed(1)} 吨`, detail: '剔除种植变更后待重估项' }, { label: '授权意向供应', value: `${(ready.reduce((s, p) => s + p.availableKg, 0) / 1000).toFixed(1)} 吨`, detail: '意向值，需到场核实和合同锁定' }, { label: '收购商权益', value: '会员 / 按条', detail: '不展示农户私有成本与精确坐标' }]}/>
    <Panel title="福安成熟分布" caption="当前为示意图，正式地块地图需测绘数据与地图服务授权" action={<Link className="secondary-button" to="/merchants">商家会员方案 →</Link>}><div className="farm-toolbar"><SearchField value={query} onChange={setQuery} placeholder="搜索地块、产品或所在地"/><label>成熟窗口<select value={window} onChange={e => setWindow(e.target.value)}><option value="全部">全部</option><option value="7">未来7天</option><option value="15">未来15天</option></select></label></div><div className="farm-map-layout"><AreaMap items={rows.map(p => ({ id: p.id, label: p.crop, detail: `${p.forecastPending ? '预测待核实' : p.harvest.slice(5)} · ${p.area}亩` }))} selected={selected?.id || ''} onSelect={setSelectedId}/><div className="farm-map-detail">{selected ? <><Tag tone={selected.forecastPending ? 'amber' : 'green'}>{selected.forecastPending ? '预测待重新核实' : daysUntil(selected.harvest) <= 7 ? '即将成熟' : '产季预告'}</Tag><h3>{selected.name}</h3><p>{selected.town} · {selected.owner}</p><div className="farm-detail-list"><div><span>产品</span><strong>{selected.crop}</strong></div><div><span>预计成熟</span><strong>{selected.forecastPending ? '待重估' : selected.harvest}</strong></div><div><span>种植规模</span><strong>{selected.area}亩</strong></div><div><span>预测总产量</span><strong>{selected.forecastPending ? '待重估' : `${selected.yieldKg.toLocaleString()}kg`}</strong></div><div><span>意向可售</span><strong>{selected.forecastPending ? '待重估' : `${selected.availableKg.toLocaleString()}kg`}</strong></div></div><p className="farm-note">意向可售与仓库实存不混用；库存批次锁定后，在库存台账中扣减。</p><Link className="primary-inline" to={`/production?plot=${selected.id}`}>查看生产档案 →</Link></> : <div className="farm-empty">没有匹配的地块</div>}</div></div></Panel>
    <Panel title="成熟与规模明细" caption="成员权益仅为管理端预览，没有真实扣费"><Table headers={['地块 / 农户', '产品', '面积', '预计成熟', '预测产量', '意向供应', '记录状态']} empty={!rows.length}>{rows.map(p => <tr key={p.id}><td><strong>{p.name}</strong><small>{p.owner}</small></td><td>{p.crop}</td><td>{p.area}亩</td><td>{p.forecastPending ? '待重估' : p.harvest}</td><td>{p.forecastPending ? '待重估' : `${p.yieldKg.toLocaleString()}kg`}</td><td>{p.forecastPending ? '待重估' : `${p.availableKg.toLocaleString()}kg`}</td><td><Link className="farm-link" to={`/records?plot=${p.id}`}>查看农事记录 →</Link></td></tr>)}</Table></Panel>
  </FarmPage>
}

const resources = [
  { id: 'RES-01', name: '赛岐1号冷库', type: '冷库', town: '赛岐镇（示例）', capacity: '500吨设计库容', status: '运行中', signal: '高于示例空载线', kwh: '186', device: '智能电表 / 网关待接入' },
  { id: 'RES-02', name: '狮子头分拣车间', type: '加工车间', town: '狮子头村（示例）', capacity: '10吨/日设计产能', status: '运行中', signal: '有功功率活跃', kwh: '62', device: '电力采集终端待接入' },
  { id: 'RES-03', name: '禾盛农服队', type: '农服队', town: '赛岐镇（示例）', capacity: '6名作业人员', status: '可预约', signal: '移动队伍，不适用电力判断', kwh: '—', device: 'NFC手机 / 读卡器待接入' },
  { id: 'RES-04', name: '陈师傅农机服务', type: '农机手', town: '甘棠镇（示例）', capacity: '拖拉机2台', status: '作业中', signal: '燃油农机，不适用电力判断', kwh: '—', device: 'NFC手机 / 读卡器待接入' },
  { id: 'RES-05', name: '乡桥农资合作门店', type: '农资门店', town: '赛岐镇（示例）', capacity: '农资购销登记', status: '营业中', signal: '暂不采集', kwh: '—', device: 'NFC读卡POS待接入' },
  { id: 'RES-06', name: '赛岐2号冷库', type: '冷库', town: '赛岐镇（示例）', capacity: '300吨设计库容', status: '待核实', signal: '低功率 / 仅可作线索', kwh: '18', device: '电力采集终端待接入' },
]
export function ResourcesPage() {
  const [type, setType] = useState('全部')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(resources[0].id)
  const [detail, setDetail] = useState<(typeof resources)[number] | null>(null)
  const rows = resources.filter(r => (type === '全部' || r.type === type) && `${r.name}${r.town}`.includes(query.trim()))
  const selected = rows.find(r => r.id === selectedId) || rows[0]
  return <FarmPage title="生产服务资源一览" description="找到县域冷库、农机手、农服队、农资门店与加工车间，分别查看服务和运行线索">
    <Stats items={[{ label: '示例服务主体', value: resources.length, detail: '不表示已实际入驻' }, { label: '资源类别', value: '5 类', detail: '冷库 / 农机 / 农服 / 加工 / 农资' }, { label: '电力采集', value: '待接入', detail: '本轮没有真实电表遥测' }, { label: '刷卡衔接', value: 'NFC', detail: '交易详情在授权服务端登记' }]}/>
    <Panel title="县域资源示意" caption="位置为布局演示，不是真实站点坐标"><div className="farm-toolbar"><SearchField value={query} onChange={setQuery} placeholder="搜索资源或所在地"/><label>资源类型<select value={type} onChange={e => setType(e.target.value)}>{['全部', '冷库', '农机手', '农服队', '加工车间', '农资门店'].map(t => <option key={t}>{t}</option>)}</select></label></div><div className="farm-map-layout"><AreaMap items={rows.map(r => ({ id: r.id, label: r.name, detail: r.type }))} selected={selected?.id || ''} onSelect={setSelectedId}/><div className="farm-map-detail">{selected ? <><Tag tone={selected.status === '待核实' ? 'amber' : 'green'}>{selected.status} / 演示</Tag><h3>{selected.name}</h3><p>{selected.town}</p><div className="farm-detail-list"><div><span>能力</span><strong>{selected.capacity}</strong></div><div><span>当日电量</span><strong>{selected.kwh} {selected.kwh === '—' ? '' : 'kWh / 示例'}</strong></div><div><span>信号说明</span><strong>{selected.signal}</strong></div><div><span>设备</span><strong>{selected.device}</strong></div></div><button className="secondary-button" onClick={() => setDetail(selected)}>查看接入要求</button></> : <div className="farm-empty">没有匹配的资源</div>}</div></div></Panel>
    <div className="farm-two-col"><Panel title="电力运行线索" caption="二期设备预留，不直接判定真实库存或产能"><div className="farm-body"><Zap size={25}/><p>固定用电主体可采用有功功率、电量与温度联动。长期基线、设备额定功率及人工反馈是判定条件，断网、断电和空载需区分。</p><p className="farm-note">燃油农机和流动作业队不能只看电力数据。电流互感器或电表接入须由合格电工处理，本轮无采集或控制功能。</p></div></Panel><Panel title="农事卡服务衔接" caption="POS / NFC读卡器 / 带NFC的服务端手机"><div className="farm-body"><CreditCard size={25}/><p>NFC用于授权身份识别与小量信息读取；农资销售登记品名、批次及数量，农机农服登记工单与实际作业，销售环节关联入库批次。</p><Link className="farm-link" to="/services">原有服务调度 →</Link></div></Panel></div>
    {detail && <Modal title={`${detail.name} · 设备接入要求`} onClose={() => setDetail(null)}><div className="farm-form"><p>{detail.device}</p><div className="farm-note">接口状态：未接入。上线需要主体授权、设备身份认证、数据时间戳及离线告警。NFC读取范围与交易写入权限分别授权。</div><p>运行状态需人工核实；本轮地图、电量和产能均为演示值。</p></div></Modal>}
  </FarmPage>
}

export function CloudFarmsPage() {
  const { state } = useFarm()
  const [selectedId, setSelectedId] = useState(state.plots[0].id)
  return <FarmPage title="云农场筹备" description="二期连接网络、摄像头与环境传感器，让消费者了解获授权的前端生产情况">
    <Stats items={[{ label: '第二年目标', value: '1000 用户', detail: '规划目标，尚未实际覆盖' }, { label: '建议先行样点', value: '20–50 地块', detail: '分阶段验证网络、电源与维护成本' }, { label: '消费者入口', value: 'nong.cloud', detail: '生产展示与认购入口不收平台费用' }, { label: '设备状态', value: '未接入', detail: '不展示伪造实时画面或遥测' }]}/>
    <Panel title="地块云农场接入清单" caption="本轮为管理端筹备预览，不是消费者网站或直播系统"><div className="farm-toolbar"><label>示例地块<select value={selectedId} onChange={e => setSelectedId(e.target.value)}>{state.plots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><Link className="farm-link" to={`/production?plot=${selectedId}`}>查看生产档案 →</Link></div><div className="farm-cloud-grid">{[{ icon: Camera, title: '现场摄像头', text: '待安装 · 镜头范围及隐私遮蔽需确认' }, { icon: Thermometer, title: '环境传感器', text: '待接入 · 温湿度与土壤数据需校准' }, { icon: Radio, title: '网络与供电', text: '待勘察 · 市电或独立太阳能按场地选择' }].map(({ icon: Icon, title, text }) => <article key={title}><Icon size={35}/><h3>{title}</h3><Tag tone="gray">二期规划</Tag><p>{text}</p></article>)}</div></Panel>
    <Panel title="上线前的授权和履约" caption="记录可见不代表品质已被认证"><div className="farm-body"><p>先落实农户展示授权、子女共享范围、摄像头隐私保护、认购合同、产量不足与退款规则，再开通消费者访问。公网视频不得默认暴露未授权人员或敏感位置。</p><Link className="farm-link" to="/verification">乡桥记录核验体系 →</Link></div></Panel>
  </FarmPage>
}
