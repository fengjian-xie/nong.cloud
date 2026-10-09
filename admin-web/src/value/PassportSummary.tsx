import { FileCheck2 } from 'lucide-react'
import { Panel, Tag } from '../farm/ui'
import { publicPassportDemo, type publicSummary } from './model'
import './value.css'
export function PassportSummary({ summary }: { summary: ReturnType<typeof publicSummary> | typeof publicPassportDemo }) {
  return <div className="value-passport"><div className="value-passport-head"><FileCheck2 size={32}/><div><small>{summary.mode}</small><h2>{summary.product}</h2><p>{summary.batchId} · v{summary.revision}</p></div><Tag tone="amber">{summary.status}</Tag></div>
    <dl className="value-grid-dl"><div><dt>产区 / 产季</dt><dd>{summary.region} / {summary.season}</dd></div><div><dt>经营主体</dt><dd>{summary.operator}</dd></div><div><dt>采收信息</dt><dd>{summary.harvest}</dd></div><div><dt>土壤依据</dt><dd>{summary.soil}</dd></div><div><dt>产品检测</dt><dd>{summary.productTest}</dd></div><div><dt>交接与实物</dt><dd>{summary.handover}</dd></div></dl>
    <h3>有来源的生产时间线</h3><div className="value-timeline">{summary.events.length ? summary.events.map((e, i) => <article key={i}><time>{e.day}</time><strong>{e.operation}</strong><small>{e.source}</small></article>) : <p>尚无满足公开摘要规则的已核验记录，不编造生产经历。</p>}</div><p className="farm-hint">{summary.mixedBatch}。本履历不替代绿色食品、有机认证或产品安全检测。</p></div>
}
export function PublicPassport() { return <Panel title="消费者看到的产品履历" caption="公开最小摘要示例；不读取任何账号的私有草稿或经营账"><PassportSummary summary={publicPassportDemo}/></Panel> }
