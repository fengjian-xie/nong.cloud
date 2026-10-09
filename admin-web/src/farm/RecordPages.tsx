import { Bluetooth, CreditCard, MapPin, Settings2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useFarm } from './FarmProvider'
import { operationOptions } from './model'
import type { Card, FarmRecord } from './model'
import { AuditTrail, FarmPage, Modal, Panel, PlotSelect, SearchField, Stats, Table, Tag, useSearchRows } from './ui'
import { farmerFeePolicy } from '../pricing'

export function CardsPage() {
  const { state, commit } = useFarm()
  const { query, setQuery, visible } = useSearchRows(state.cards)
  const [status, setStatus] = useState('全部')
  const [selected, setSelected] = useState<Card | null>(null)
  const rows = visible.filter(c => status === '全部' || c.status === status)
  return <FarmPage title="农事卡管理" description="合作社或子女代办激活，远程配置作业键，跟进离线记录与设备状态">
    <p className="farm-note">{farmerFeePolicy}</p>
    <Stats items={[{ label: '工程样机阶段', value: '20 张', detail: '一期目标 · 当前8张示例卡' }, { label: '已激活样卡', value: state.cards.filter(c => c.status === '已激活').length, detail: '农户免平台服务费，卡片另行收费' }, { label: '待同步事件', value: state.cards.reduce((s, c) => s + c.pending, 0), detail: 'BLE上传 · NFC用于刷卡衔接' }, { label: '待设备确认', value: state.cards.filter(c => c.version > c.deviceVersion).length, detail: '服务器版本与设备版本需一致' }]}/>
    <Panel title="卡片台账" caption="硬件参数为研发目标，不代表工程样机已验证" action={<Tag tone="gray">GNSS · BLE · NFC / 无Wi-Fi</Tag>}>
      <div className="farm-toolbar"><SearchField value={query} onChange={setQuery} placeholder="搜索卡号、农户或代办人"/><label>状态<select value={status} onChange={e => setStatus(e.target.value)}>{['全部', '已激活', '未激活', '已挂失'].map(s => <option key={s}>{s}</option>)}</select></label></div>
      <Table headers={['卡号 / 固件', '使用农户 / 代办', '状态', '电量 / 同步', '作业A · B · C', '配置版本', '操作']} empty={!rows.length}>{rows.map(c => <tr key={c.id}><td><strong>{c.id}</strong><small>{c.firmware}</small></td><td><strong>{c.farmer}</strong><small>{c.delegate}</small></td><td><Tag tone={c.status === '已激活' ? 'green' : c.status === '已挂失' ? 'red' : 'gray'}>{c.status}</Tag></td><td><div className="farm-battery"><i style={{ width: `${c.battery}%`, background: c.battery < 20 ? '#d94b3d' : '#0b8a4c' }}/></div><small>{c.battery}% · {c.pending}条待同步</small></td><td>{c.keys.join(' / ')}</td><td><Tag tone={c.version > c.deviceVersion ? 'amber' : 'gray'}>平台v{c.version} / 卡v{c.deviceVersion}</Tag></td><td><div className="farm-actions"><button className="farm-link" onClick={() => setSelected(c)}><Settings2 size={14}/>{c.status === '未激活' ? '激活绑定' : '管理'}</button><button className="farm-link" disabled={c.status !== '已激活'} onClick={() => commit({ type: 'sync', id: c.id })}><Bluetooth size={14}/>模拟同步</button></div></td></tr>)}</Table>
    </Panel>
    <div className="farm-two-col"><Panel title="卡片操作约定" caption="适老化：只记事件，不要求农户填写表单"><div className="farm-body"><div className="farm-key-preview"><b>开工</b><b className="stop">收工</b><b>A</b><b>B</b><b>C</b></div><p>开工、收工键固定；A、B、C在官网或小程序设置。记录携带当时的按键配置版本，不以新配置改写历史作业。</p><p>身份证大小、厚度≤2.3mm、GNSS定位、指示灯、离线存储、约月充目标需由样机实测确认。</p></div></Panel><Panel title="服务衔接" caption="刷卡身份识别与交易记录分离"><div className="farm-body"><CreditCard size={26}/><p>农资门店、农机手、农服队和收购点通过NFC识别卡片，服务端记录实际商品、数量与服务内容；大批量农事日志通过BLE上传。</p><Link className="farm-link" to="/resources">查看服务资源与设备接入 →</Link></div></Panel></div>
    <AuditTrail/>
    {selected && <CardEditor card={state.cards.find(c => c.id === selected.id)!} onClose={() => setSelected(null)}/>}
  </FarmPage>
}

function CardEditor({ card, onClose }: { card: Card; onClose: () => void }) {
  const { commit } = useFarm()
  const [keys, setKeys] = useState<Card['keys']>([...card.keys])
  const [farmer, setFarmer] = useState('')
  const [delegate, setDelegate] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  return <Modal title={`${card.id} · ${card.status === '未激活' ? '激活绑定' : '卡片设置'}`} onClose={onClose}>
    <div className="farm-form"><div className="farm-note">此窗口为本地流程演示，不会连接或修改实体卡。农户定位与子女共享需要独立授权。</div>
      {card.status === '未激活' ? <form onSubmit={e => { e.preventDefault(); if (!farmer.trim() || !delegate.trim() || !consent) return setError('请填写农户、代办人并勾选授权确认'); if (commit({ type: 'activate', id: card.id, farmer, delegate, consent })) onClose() }}>
        <label>农户姓名<input value={farmer} onChange={e => setFarmer(e.target.value)} required maxLength={30}/></label><label>代办人 / 合作社<input value={delegate} onChange={e => setDelegate(e.target.value)} required maxLength={50}/></label><label className="farm-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>已获得农户绑定、定位记录和代办授权（示例）</label>{error && <p role="alert">{error}</p>}<button className="primary-inline">保存演示绑定</button>
      </form> : <>
        <div className="farm-detail-list"><div><span>农户</span><strong>{card.farmer} / {card.delegate}</strong></div><div><span>最近同步</span><strong>{card.lastSync}</strong></div><div><span>配置下发</span><strong>平台v{card.version} · 设备v{card.deviceVersion}</strong></div></div>
        <form onSubmit={e => { e.preventDefault(); if (commit({ type: 'configure', id: card.id, keys })) onClose() }}><h3>自定义作业按键</h3>{keys.map((key, index) => <label key={index}>作业{['A', 'B', 'C'][index]}<select disabled={card.status !== '已激活'} value={key} onChange={e => setKeys(current => current.map((k, i) => i === index ? e.target.value : k) as Card['keys'])}>{operationOptions.map(o => <option key={o}>{o}</option>)}</select></label>)}<p className="farm-note">保存后为“待下发”，只有设备回执确认后才生效。本轮可用模拟同步验证此流程。</p><button className="primary-inline" disabled={card.status !== '已激活'}>发布配置版本</button></form>
        <div className="farm-modal-actions"><button className="secondary-button" onClick={() => { if (commit({ type: 'cardStatus', id: card.id, status: card.status === '已挂失' ? '已激活' : '已挂失' })) onClose() }}>{card.status === '已挂失' ? '恢复卡片（演示）' : '挂失停用（演示）'}</button></div>
        <h3>配置历史</h3>{card.history.map(h => <p className="farm-history" key={h.version}>v{h.version} · {h.keys.join(' / ')}<small>{h.at}</small></p>)}
      </>}
    </div>
  </Modal>
}

export function RecordsPage() {
  const { state } = useFarm()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || '全部'
  const { query, setQuery, visible } = useSearchRows(state.records)
  const [selected, setSelected] = useState<FarmRecord | null>(null)
  const [onlyAbnormal, setOnlyAbnormal] = useState(false)
  const rows = visible.filter(r => (status === '全部' || r.status === status) && (!params.get('plot') || (r.review?.plotId || r.plotId) === params.get('plot')) && (!onlyAbnormal || r.accuracy === null || r.accuracy > 30))
  return <FarmPage title="农事记录" description="查看离线事件、GNSS地块匹配及NFC服务记录，原始日志不因人工核验而覆盖">
    <Stats items={[{ label: '原始事件', value: state.records.length, detail: '开工 / 收工 / 作业键记录' }, { label: '待核验', value: state.records.filter(r => r.status === '待核验').length, detail: '同步后由运营人员核实' }, { label: '定位待确认', value: state.records.filter(r => r.accuracy === null || r.accuracy > 30).length, detail: '无定位或误差>30m' }, { label: '已核验', value: state.records.filter(r => r.status === '已核验').length, detail: '内部核验不等于品质认证' }]}/>
    <Panel title="事件台账" caption="GNSS与按键仅是记录线索，不能单独证明作业或投入品真实使用">
      <div className="farm-toolbar"><SearchField value={query} onChange={setQuery} placeholder="搜索事件、卡号、农户或作业"/><label>核验状态<select value={status} onChange={e => { const next = new URLSearchParams(params); if (e.target.value === '全部') next.delete('status'); else next.set('status', e.target.value); setParams(next) }}>{['全部', '待核验', '已核验', '已驳回'].map(s => <option key={s}>{s}</option>)}</select></label><label className="farm-check"><input type="checkbox" checked={onlyAbnormal} onChange={e => setOnlyAbnormal(e.target.checked)}/>仅定位异常</label>{params.get('plot') && <button className="farm-link" onClick={() => setParams({})}>清除地块筛选</button>}</div>
      <Table headers={['事件 / 时间', '农户 / 卡片', '作业 / 来源', '地块 / 定位', '同步', '核验状态', '操作']} empty={!rows.length}>{rows.map(r => { const plot = state.plots.find(p => p.id === (r.review?.plotId || r.plotId)); return <tr key={r.id}><td><strong>{r.id}</strong><small>{r.at}</small></td><td>{r.farmer}<small>{r.cardId}</small></td><td><strong>{r.operation}</strong><small>{r.source} · 按键v{r.configVersion}</small></td><td>{plot?.name || '待匹配'}<small className={r.accuracy === null || r.accuracy > 30 ? 'farm-amber' : ''}>{r.accuracy === null ? '无有效GNSS定位' : `定位精度 ±${r.accuracy}m`}</small></td><td><Tag tone={r.synced ? 'gray' : 'amber'}>{r.synced ? '已同步' : '卡内离线'}</Tag></td><td><Tag tone={r.status === '已核验' ? 'green' : r.status === '已驳回' ? 'red' : 'amber'}>{r.status}</Tag></td><td><button className="farm-link" onClick={() => setSelected(r)}><ShieldCheck size={14}/>{r.status === '待核验' ? '核验记录' : '查看留痕'}</button></td></tr> })}</Table>
    </Panel>
    {selected && <RecordReview record={state.records.find(r => r.id === selected.id)!} onClose={() => setSelected(null)}/>}
  </FarmPage>
}

function RecordReview({ record, onClose }: { record: FarmRecord; onClose: () => void }) {
  const { commit } = useFarm()
  const [plotId, setPlotId] = useState(record.review?.plotId || record.plotId)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  function decide(approve: boolean) {
    if (reason.trim().length < 5) return setError('请填写至少5个字的核验依据')
    if (approve && !record.synced) return setError('请先到农事卡管理完成模拟同步，再核验该事件')
    if (commit({ type: 'reviewRecord', id: record.id, plotId, reason, approve })) onClose()
  }
  return <Modal title={`${record.id} · 记录核验`} onClose={onClose}><div className="farm-form"><div className="farm-note"><MapPin size={16}/>原始地块 {record.plotId} · {record.operation} · {record.at} · 按键v{record.configVersion}</div>
    {record.status === '待核验' ? <><PlotSelect value={plotId} onChange={setPlotId} label="确认工作地块"/><label>核验依据 / 纠偏原因<textarea rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="例如：向农户核实边界和作业情况；保留原始位置" maxLength={500}/></label>{!record.synced && <p className="farm-warning">事件仍在卡内。需先模拟同步，不能直接通过核验。</p>}{error && <p role="alert" className="farm-warning">{error}</p>}<div className="farm-modal-actions"><button className="secondary-button" onClick={() => decide(false)}>驳回记录</button><button className="primary-inline" onClick={() => decide(true)} disabled={!record.synced}>核验通过</button></div></> : <div className="farm-detail-list"><div><span>结果</span><strong>{record.status}</strong></div><div><span>说明</span><strong>{record.review?.reason || '演示种子数据，未提供核验附件'}</strong></div><div><span>核验地块</span><strong>{record.review?.plotId || record.plotId}</strong></div></div>}
    <Link className="farm-link" to={`/production?plot=${plotId}`} onClick={onClose}>查看生产档案 →</Link></div></Modal>
}
