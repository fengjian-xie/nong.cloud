import { useEffect, useState } from 'react'
import { ContentDialog } from '../components/ContentDialog'
import { BackendError, pageRows, request, type Page, type Row } from './client'

export function CardHistoryDialog({ card, identity, onClose }: { card: Row; identity: string; onClose: () => void }) {
  const [kind, setKind] = useState('events'), [page, setPage] = useState(1), [data, setData] = useState<Page | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setData(null); setError('')
    request<Page>(`/cards/${encodeURIComponent(String(card.id))}/${kind}?page=${page}&size=10`, { identity, signal: controller.signal }).then(value => {pageRows(value);if(!controller.signal.aborted)setData(value)}).catch(e => {if(!controller.signal.aborted)setError(e instanceof BackendError?`${e.message} · ${e.traceId}`:'读取失败')}).finally(() => {if(!controller.signal.aborted)setLoading(false)})
    return () => controller.abort()
  }, [card.id, identity, kind, page])
  return <ContentDialog title="农事卡记录与历史" onClose={onClose} notice={error}><p>卡号：{String(card.id)}。这是云端软件记录，不证明蓝牙/NFC连接、实物状态或作业质量。</p><div className="connected-actions">{[['events','采集入库记录'],['configuration-history','按键配置历史'],['binding-history','绑定与状态历史']].map(([id,label])=><button key={id} aria-pressed={kind===id} onClick={()=>{setKind(id);setPage(1)}}>{label}</button>)}</div>{loading?<p>正在读取数据库…</p>:data?<><p>共 {data.total} 条 · 第 {data.page} 页</p>{data.items.map(row=><article className="connected-history-row" key={String(row.id)}>{kind==='events'?<><strong>{String(row.operation)} · 未验证</strong><p>事件 {String(row.eventId)} · 配置 V{String(row.configVersion)} · 绑定 V{String(row.bindingVersion)}</p><p>发生 {String(row.occurredAt)} / 入库 {String(row.receivedAt)}（UTC）</p><p>定位：{String(row.fixStatus)}；不自动确认所属地块。</p></>:kind==='configuration-history'?<><strong>云端配置 V{String(row.version)}</strong><p>{['A','B','C'].map(k=>`${k}：${(row.configuration as Row)?.[k]||'未设置'}`).join(' · ')}</p><small>{String(row.createdAt)}</small></>:<><strong>绑定 V{String(row.bindingVersion)} · {String(row.status)}</strong><p>{String(row.reason)}</p><small>{String(row.createdAt)}</small></>}</article>)}{!data.items.length&&<p>暂无入库记录；不使用模拟同步数据替代。</p>}<div className="connected-actions"><button disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)}>上一页</button><button disabled={loading||!data.hasNext} onClick={()=>setPage(p=>p+1)}>下一页</button></div></>:null}</ContentDialog>
}
