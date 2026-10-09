import { useEffect, useState } from 'react'
import { request } from './client'
import { validGuidance, type Guidance } from './guidance'
export function WorkGuidance({identity}: {identity:string}) {
 const [guide,setGuide]=useState<Guidance|null>(null),[failed,setFailed]=useState(false)
 useEffect(()=>{
  const controller=new AbortController();setGuide(null);setFailed(false)
  request<unknown>('/work-guidance',{identity,signal:controller.signal}).then(data=>{
   if(controller.signal.aborted)return
   if(!validGuidance(data,identity))throw new Error('指引身份或格式不匹配')
   setGuide(data)
  }).catch(()=>{if(!controller.signal.aborted)setFailed(true)})
  return()=>controller.abort()
 },[identity])
 if(!guide)return failed?<p className="connected-footnote">办事指引暂不可用，不影响业务记录读取；不会展示其他身份的指引。请刷新重试。</p>:<p className="connected-footnote" role="status">正在读取当前身份办事指引…</p>
 return <section className="connected-guidance" aria-label="当前身份办事指引">
  <h2>{guide.title}</h2>
  {guide.fees.length>0&&<div className="connected-guidance-fees">{guide.fees.map(f=><p key={f.label}><strong>{f.label}：{(f.feeFen/100).toFixed(2)}元</strong><small>{f.note}</small></p>)}</div>}
  <details><summary>查看办理流程、验收要点与未接通事项</summary>
   <ol>{guide.steps.map(s=><li key={s.module}><strong>{s.title}</strong><p>{s.detail}</p></li>)}</ol>
   <h3>核对要点</h3><ul>{guide.checks.map(s=><li key={s}>{s}</li>)}</ul>
   {guide.limits.map(s=><small key={s}>{s}</small>)}
  </details>
 </section>
}
