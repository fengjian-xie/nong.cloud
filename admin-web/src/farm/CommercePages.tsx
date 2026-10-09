import { ArrowRight, Package, Plus, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFarm } from './FarmProvider'
import { available, money, now, uid } from './model'
import type { Merchant, StockBatch } from './model'
import { FarmPage, Modal, Panel, PlotSelect, SearchField, Stats, Table, Tag, useSearchRows } from './ui'

export function InventoryPage({ procurement = false }: { procurement?: boolean }) {
  const { state, commit } = useFarm()
  const { query, setQuery, visible } = useSearchRows(state.batches)
  const [grade, setGrade] = useState('全部')
  const [selected, setSelected] = useState<StockBatch | null>(null)
  const [adding, setAdding] = useState(false)
  const rows = visible.filter(b => (!procurement || b.origin === '收购入库') && (grade === '全部' || b.grade === grade))
  const ownOrders = state.orders.filter(o => o.status === '已出库' && state.batches.find(b => b.id === o.batchId)?.origin === '收购入库')
  const revenue = ownOrders.reduce((s, o) => s + o.quantity * o.price, 0)
  const difference = ownOrders.reduce((s, o) => s + o.quantity * (o.price - state.batches.find(b => b.id === o.batchId)!.price), 0)
  return <FarmPage title={procurement ? '自营收购与销售' : '共享库存与尾货'} description={procurement ? '向合作社种植户收购、分级入库、锁定订单及出库，保留地块与批次关联' : '按批次共享可用库存，匹配分拣车间与加工商需求；库存与电力活跃度分开核实'} action={procurement ? <button className="primary-inline" onClick={() => setAdding(true)}><Plus size={16}/>新增收购入库</button> : <Link className="secondary-button" to="/procurement">自营收购台账 <ArrowRight size={15}/></Link>}>
    <Stats items={procurement ? [{ label: '自营库存 / 可用', value: `${state.batches.filter(b => b.origin === '收购入库').reduce((s, b) => s + available(b), 0).toLocaleString()} kg`, detail: '净重，不包含已锁定与已出库量' }, { label: '本轮出库合同金额', value: `¥${money(revenue)}`, detail: '不代表到账或营业利润' }, { label: '本轮购销账面差价', value: `¥${money(difference)}`, detail: '未扣除仓储、损耗、物流及税费' }, { label: '待出库订单', value: state.orders.filter(o => o.status === '已锁定').length, detail: '含自营与共享示例订单' }] : [{ label: '共享及自营批次', value: state.batches.length, detail: '全部为演示批次' }, { label: '可用B级货', value: `${state.batches.filter(b => b.grade === 'B级').reduce((s, b) => s + available(b), 0).toLocaleString()} kg`, detail: '2000斤需求 = 1000kg' }, { label: '锁定库存', value: `${state.batches.reduce((s, b) => s + b.reserved, 0).toLocaleString()} kg`, detail: '取消释放，出库转为已售' }, { label: '交易方式', value: '批次协同', detail: '不从农户销售款中扣平台费用' }]}/>
    {!procurement && <div className="farm-demand"><span className="farm-demand-icon"><ShoppingCart size={24}/></span><div><strong>示例需求 · 分拣车间需要B级葡萄2000斤</strong><p>可按库存批次锁定1000kg。实际采购需核验等级、保鲜期、权属及称重。</p></div><Tag tone="amber">非真实采购订单</Tag></div>}
    <Panel title={procurement ? '乡桥自营入库批次' : '库存共享台账'} caption="保鲜期筛选按演示基准日2026-08-29；不依据耗电量推算库存"><div className="farm-toolbar"><SearchField value={query} onChange={setQuery} placeholder="搜索批次、产品、库位或库存主体"/><label>等级<select value={grade} onChange={e => setGrade(e.target.value)}>{['全部', 'A级', 'B级', 'C级'].map(s => <option key={s}>{s}</option>)}</select></label><span className="farm-muted">统一单位：kg（1kg=2斤）</span></div>
      <Table headers={['批次 / 产品', '主体 / 来源', '库位 / 保鲜截止', '入库净重', '已锁定', '已出库', '可用库存', '入库价 / 报价', '操作']} empty={!rows.length}>{rows.map(b => <tr key={b.id}><td><strong>{b.product} · {b.grade}</strong><small>{b.id}</small></td><td>{b.owner}<small>{b.origin}</small></td><td>{b.storage}<small>{b.expires}</small></td><td>{b.quantity.toLocaleString()}kg</td><td>{b.reserved.toLocaleString()}kg</td><td>{b.sold.toLocaleString()}kg</td><td><strong className="farm-green">{available(b).toLocaleString()}kg</strong></td><td>¥{money(b.price)}/kg</td><td><button className="farm-link" disabled={available(b) <= 0} onClick={() => setSelected(b)}>锁定采购</button></td></tr>)}</Table>
    </Panel>
    <Panel title="订单与履约台账" caption="只演示库存状态，不执行付款、转账、合同签署或发货通知"><Table headers={['订单 / 时间', '批次 / 采购商', '数量', '成交单价', '合同金额', '状态', '操作']} empty={!state.orders.length}>{state.orders.map(o => <tr key={o.id}><td><strong>{o.id}</strong><small>{o.at}</small></td><td>{o.buyer}<small>{o.batchId}</small></td><td>{o.quantity.toLocaleString()}kg</td><td>¥{money(o.price)}</td><td>¥{money(o.quantity * o.price)}</td><td><Tag tone={o.status === '已锁定' ? 'amber' : o.status === '已出库' ? 'green' : 'gray'}>{o.status}</Tag></td><td>{o.status === '已锁定' ? <div className="farm-actions"><button className="farm-link" onClick={() => commit({ type: 'orderStatus', id: o.id, status: '已出库' })}>确认模拟出库</button><button className="farm-link farm-danger" onClick={() => commit({ type: 'orderStatus', id: o.id, status: '已取消' })}>取消 / 释放库存</button></div> : '已处理'}</td></tr>)}</Table></Panel>
    {selected && <ReserveForm batch={state.batches.find(b => b.id === selected.id)!} onClose={() => setSelected(null)}/>}{adding && <PurchaseForm onClose={() => setAdding(false)}/>}
  </FarmPage>
}
export function ProcurementPage() { return <InventoryPage procurement/> }

function ReserveForm({ batch, onClose }: { batch: StockBatch; onClose: () => void }) {
  const { commit } = useFarm()
  const [quantity, setQuantity] = useState(Math.min(1000, available(batch)))
  const [unit, setUnit] = useState('kg')
  const [buyer, setBuyer] = useState('')
  const [price, setPrice] = useState(batch.origin === '收购入库' ? Number((batch.price * 1.35).toFixed(2)) : batch.price)
  const [error, setError] = useState('')
  const quantityKg = Math.round((unit === '斤' ? quantity / 2 : quantity) * 1000) / 1000
  return <Modal title={`${batch.id} · 锁定采购`} onClose={onClose}><form className="farm-form" onSubmit={e => { e.preventDefault(); if (!buyer.trim() || quantityKg <= 0 || quantityKg > available(batch) || price <= 0) return setError('请填写采购商、正数价格及不超过可用库存的数量'); if (commit({ type: 'reserve', order: { id: uid('ORDER'), batchId: batch.id, buyer, quantity: quantityKg, price } })) onClose() }}><div className="farm-note">{batch.product} · {batch.grade} · 可用{available(batch)}kg。本地锁库存，不产生真实订单或扣款。</div><label>采购主体<input value={buyer} onChange={e => setBuyer(e.target.value)} required maxLength={80}/></label><div className="farm-form-grid"><label>锁定数量<input value={quantity} onChange={e => setQuantity(Number(e.target.value))} type="number" min="0.001" step="0.001" required/></label><label>数量单位<select value={unit} onChange={e => { setQuantity(current => e.target.value === '斤' ? current * 2 : current / 2); setUnit(e.target.value) }}><option>kg</option><option>斤</option></select></label></div><label>协商成交价（元/kg）<input type="number" min="0.01" step="0.01" required value={price} onChange={e => setPrice(Number(e.target.value))}/></label><div className="farm-order-summary"><Package size={20}/><span>净重 {quantityKg}kg · {quantityKg * 2}斤<br/><strong>合同金额 ¥{money(quantityKg * price)}</strong></span></div>{error && <p className="farm-warning" role="alert">{error}</p>}<button className="primary-inline">确认模拟锁定</button></form></Modal>
}
function PurchaseForm({ onClose }: { onClose: () => void }) {
  const { state, commit } = useFarm()
  const [plotId, setPlotId] = useState(state.plots[0].id)
  const [quantity, setQuantity] = useState(1000)
  const [price, setPrice] = useState(6)
  const [grade, setGrade] = useState('A级')
  const [storage, setStorage] = useState('赛岐1号冷库')
  const [expires, setExpires] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toLocaleDateString('sv-SE') })
  const [error, setError] = useState('')
  const plot = state.plots.find(p => p.id === plotId)!
  return <Modal title="新增收购入库（演示）" onClose={onClose}><form className="farm-form" onSubmit={e => { e.preventDefault(); if (commit({ type: 'purchase', batch: { id: uid('BATCH'), plotId, product: plot.crop, grade, quantity, price, storage, expires, reserved: 0, sold: 0, origin: '收购入库', owner: '乡桥自营' } })) onClose(); else setError('入库未保存，请检查数量、价格、库位及保鲜截止日') }}><PlotSelect value={plotId} onChange={setPlotId} label="收购来源地块"/><div className="farm-note">来源农户：{plot.owner} · 产品：{plot.crop}。成本估算不自动成为成交价。</div><div className="farm-form-grid"><label>实际收购净重（kg）<input type="number" min="0.001" step="0.001" required value={quantity} onChange={e => setQuantity(Number(e.target.value))}/></label><label>协商收购价（元/kg）<input type="number" min="0.01" step="0.01" required value={price} onChange={e => setPrice(Number(e.target.value))}/></label></div><label>等级<select value={grade} onChange={e => setGrade(e.target.value)}>{['A级', 'B级', 'C级'].map(g => <option key={g}>{g}</option>)}</select></label><label>入库库位<input required value={storage} onChange={e => setStorage(e.target.value)} maxLength={80}/></label><label>保鲜截止日<input required type="date" min={now().slice(0, 10)} value={expires} onChange={e => setExpires(e.target.value)}/></label><p className="farm-note">示例入库应付 ¥{money(quantity * price)}；未付款，不能作为实际结算凭证。正式系统需称重单、质检、合同及财务审核。</p>{error && <p className="farm-warning" role="alert">{error}</p>}<button className="primary-inline">登记模拟入库</button></form></Modal>
}

export function MerchantsPage() {
  const { state } = useFarm()
  const [selected, setSelected] = useState<Merchant | null>(null)
  return <FarmPage title="商家服务与会员" description="收购商按会员或信息条目使用；农户、合作社生产记录与消费者查看认购入口免费">
    <div className="farm-free-banner"><div><span>经营底线</span><h2>不在生产端，不向农户收平台费用。</h2><p>农事记录平台服务、地块档案与授权查看免费；农事卡办卡、补卡均100元/张。消费者平台服务免费，产品价款另计。自营购销通过商品差价经营。</p></div><Tag>生产端 ¥0</Tag></div>
    <Stats items={[{ label: '收购商试点方案', value: '≤ ¥999', detail: '收费口径为演示，可另行商议' }, { label: '按条查看', value: '单条权益', detail: '正式计费需防重复扣费与授权' }, { label: '示例商家', value: state.merchants.length, detail: '未接入支付与真实订阅' }, { label: '数据服务', value: '授权汇总', detail: '不直接出售农户身份与精确位置' }]}/>
    <Panel title="商家方案台账" caption="本轮只保存方案，不生成订阅合同或扣款"><Table headers={['商家', '类型', '服务模式', '示例费用', '状态', '操作']}>{state.merchants.map(m => <tr key={m.id}><td><strong>{m.name}</strong><small>{m.id}</small></td><td>{m.type}</td><td>{m.mode}</td><td>¥{money(m.fee)} / {m.mode === '年会员' ? '年' : '条'}</td><td><Tag tone={m.status === '已开通' ? 'green' : 'amber'}>{m.status}（演示）</Tag></td><td><button className="farm-link" onClick={() => setSelected(m)}>配置服务方案</button></td></tr>)}</Table></Panel>
    <div className="farm-two-col"><Panel title="数据服务收入" caption="机构、产业带与企业端"><div className="farm-body"><p>提供获授权的产量、成熟窗口、供需与成本趋势的聚合报告。数据收益不承诺固定回报，不把记录核验当作金融信用背书。</p><Link className="farm-link" to="/maturity">成熟与供应一览 →</Link></div></Panel><Panel title="商家与自营收入" caption="独立于农户记录服务"><div className="farm-body"><p>商家工具、NFC服务衔接、采购信息权益与自营农产品购销。正式经营应分别核算商品收入、服务费和毛利。</p><Link className="farm-link" to="/procurement">自营购销台账 →</Link></div></Panel></div>
    {selected && <MerchantForm merchant={selected} onClose={() => setSelected(null)}/>}
  </FarmPage>
}
function MerchantForm({ merchant, onClose }: { merchant: Merchant; onClose: () => void }) {
  const { commit } = useFarm()
  const [mode, setMode] = useState(merchant.mode)
  const [fee, setFee] = useState(merchant.fee)
  return <Modal title={`${merchant.name} · 服务方案`} onClose={onClose}><form className="farm-form" onSubmit={e => { e.preventDefault(); if (commit({ type: 'merchant', id: merchant.id, mode, fee })) onClose() }}><label>服务模式<select value={mode} onChange={e => { setMode(e.target.value as Merchant['mode']); setFee(e.target.value === '年会员' ? 699 : 9.9) }}><option>年会员</option><option>按条查看</option></select></label><label>费用（元/{mode === '年会员' ? '年' : '条'}）<input type="number" min={0} max={999} step="0.01" value={fee} onChange={e => setFee(Number(e.target.value))} required/></label><p className="farm-note">999以内仅为当前试点方案。农户记录永久免费；没有实际付费授权、支付或单条查看扣费接口。</p><button className="primary-inline">保存演示方案</button></form></Modal>
}
