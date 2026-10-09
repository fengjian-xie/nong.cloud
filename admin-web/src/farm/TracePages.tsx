import { ArrowRight, Download, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFarm } from './FarmProvider'
import { traceIssues } from './model'
import { AuditTrail, FarmPage, Panel, PlotSelect, Stats, Table, Tag } from './ui'

function downloadPreview(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function VerificationPage() {
  const { state } = useFarm()
  const ready = state.plots.filter(p => !traceIssues(state, p.id).length)
  return <FarmPage title="乡桥农事记录认证体系" description="以记录采集、材料核验、版本留档和异常追踪建立可信记录；当前为内部核验流程">
    <div className="farm-cert-notice"><ShieldCheck size={28}/><div><strong>乡桥内部记录核验 ≠ 绿色食品标识或食品安全认证</strong><p>目前未建立第三方认证资质或正式发证流程，不出具品质保证。绿色食品等官方认证需另行申请与审核。</p></div></div>
    <Stats items={[{ label: '生产档案', value: state.plots.length, detail: '包含多年种植和产季版本' }, { label: '内部预检可通过', value: ready.length, detail: '依据当前试点必填规则' }, { label: '待审核变更', value: state.changes.filter(c => c.status === '待审核').length, detail: '照片和视频两类材料为必要项' }, { label: '正式发证', value: '未启用', detail: '无官方或第三方背书' }]}/>
    <Panel title="地块记录核验进度" caption="规则结果与来源证据需由授权人员确认"><Table headers={['地块 / 农户', '产季版本', '当前缺项', '内部预检', '操作']}>{state.plots.map(p => { const issues = traceIssues(state, p.id); return <tr key={p.id}><td><strong>{p.name}</strong><small>{p.owner}</small></td><td>v{p.version} · {p.season}</td><td className="farm-wrap-cell">{issues.length ? issues.join('；') : '当前试点必填项齐备'}</td><td><Tag tone={issues.length ? 'amber' : 'green'}>{issues.length ? '待完善' : '可内部归档'}</Tag></td><td><div className="farm-actions"><Link className="farm-link" to={`/records?plot=${p.id}`}>记录核验</Link><Link className="farm-link" to="/trace">报送预检 →</Link></div></td></tr> })}</Table></Panel>
    <Panel title="体系控制点" caption="上线前需配套角色分权、服务端日志与定期抽查"><div className="farm-rules">{[
      ['01', '身份与授权', '农户绑定、合作社或子女代办、定位用途和共享范围独立确认。'],
      ['02', '原始记录', 'GNSS精度、卡号、按键配置版本、设备事件序号与上传回执可追溯。'],
      ['03', '作物变更', '同时保留照片、视频和原因；提交与审核分权，旧档案不覆盖。'],
      ['04', '投入与机构证据', '农资购买不等于实际使用；土壤报告需核对采样链和机构来源。'],
      ['05', '抽查与异常', '定位错误、漏记、误按和内容争议允许纠偏，原始记录与处理说明同时保留。'],
    ].map(([number, title, text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></Panel>
    <AuditTrail/>
  </FarmPage>
}

export function TracePage() {
  const { state, commit } = useFarm()
  const [plotId, setPlotId] = useState(state.plots[0].id)
  const plot = state.plots.find(p => p.id === plotId)!
  const issues = traceIssues(state, plotId)
  const existing = state.traces.find(t => t.plotId === plotId)
  const records = state.records.filter(r => (r.review?.plotId || r.plotId) === plotId && r.synced && r.status === '已核验')
  return <FarmPage title="追溯报送与一品一码" description="先校验生产档案与农事证据，预留外部报送适配；当前只生成本地演示任务">
    <Stats items={[{ label: '目标外部平台', value: '一品一码', detail: '接口规范、授权与联调待确认' }, { label: '连接状态', value: '未接入', detail: '不会发送政府平台请求' }, { label: '本地预检任务', value: state.traces.length, detail: '带DEMO前缀，不是正式回执' }, { label: '模拟失败任务', value: state.traces.filter(t => t.status === '模拟失败').length, detail: '重试原任务，避免重复创建' }]}/>
    <div className="farm-two-col"><Panel title="报送前数据预检" caption="乡桥内部规则，不代表一品一码官方字段标准"><div className="farm-body farm-form"><PlotSelect value={plotId} onChange={setPlotId}/><div className="farm-precheck"><Tag tone={issues.length ? 'amber' : 'green'}>{issues.length ? `${issues.length}项待完善` : '内部预检通过'}</Tag>{issues.length ? <ul>{issues.map(i => <li key={i}>{i}</li>)}</ul> : <p>档案、归档土壤报告和已同步核验记录具备；外部标准仍需适配。</p>}</div><div className="farm-actions"><button className="primary-inline" disabled={!!issues.length || !!existing} onClick={() => commit({ type: 'trace', plotId })}>生成本地预检任务</button><Link className="farm-link" to={`/records?plot=${plotId}`}>处理农事记录 <ArrowRight size={14}/></Link></div>{existing && <p className="farm-note">此地块已有任务，请在下方查看或重试，不重复创建。</p>}</div></Panel>
      <Panel title="报送资料预览" caption="内部JSON格式，仅用于需求讨论与适配开发"><div className="farm-body"><div className="farm-detail-list"><div><span>地块</span><strong>{plot.name}</strong></div><div><span>产品 / 产季</span><strong>{plot.crop} / {plot.season}</strong></div><div><span>档案版本</span><strong>v{plot.version}</strong></div><div><span>合格内部记录</span><strong>{records.length}条</strong></div><div><span>外部回执</span><strong>无 / 未接入</strong></div></div><button className="secondary-button" onClick={() => downloadPreview({ purpose: '乡桥内部演示，不是一品一码标准报文', externalConnected: false, plot, records, soils: state.soils.filter(s => s.plotId === plotId && s.status === '已归档') }, `乡桥_内部资料预览_${plotId}.json`)}><Download size={16}/>导出内部资料JSON</button></div></Panel></div>
    <Panel title="本地任务与重试" caption="模拟成功不等于正式报送成功；接入后由外部平台回执决定结果"><Table headers={['演示任务 / 地块', '状态', '尝试次数', '说明', '操作']} empty={!state.traces.length}>{state.traces.map(t => <tr key={t.id}><td><strong>{t.id}</strong><small>{state.plots.find(p => p.id === t.plotId)?.name}</small></td><td><Tag tone={t.status === '模拟失败' ? 'red' : t.status === '模拟完成' ? 'green' : 'amber'}>{t.status}</Tag></td><td>{t.attempts}</td><td className="farm-wrap-cell">{t.detail}</td><td>{t.status !== '模拟完成' ? <div className="farm-actions"><button className="farm-link" onClick={() => commit({ type: 'traceRun', id: t.id, fail: true })}>模拟超时</button><button className="farm-link" onClick={() => commit({ type: 'traceRun', id: t.id, fail: false })}>{t.status === '模拟失败' ? '重试模拟' : '模拟执行'}</button></div> : <span className="farm-muted">无正式平台回执</span>}</td></tr>)}</Table></Panel>
  </FarmPage>
}
