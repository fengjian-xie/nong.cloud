import { useRef, type KeyboardEvent } from 'react'
import { Camera } from 'lucide-react'
import { demoNotice, records } from './site'

export function DemoNotice() { return <p className="cf-notice">{demoNotice}</p> }
export function SectionTabs({ labels, selected, onChange, name, id }: { labels: string[]; selected: number; onChange: (index: number) => void; name: string; id: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  function keyboard(event: KeyboardEvent, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % labels.length : event.key === 'ArrowLeft' ? (index + labels.length - 1) % labels.length : event.key === 'Home' ? 0 : event.key === 'End' ? labels.length - 1 : -1
    if (next < 0) return
    event.preventDefault(); onChange(next); refs.current[next]?.focus()
  }
  return <div className="cf-tabs" role="tablist" aria-label={name}>{labels.map((label, index) => <button type="button" key={label} ref={element => { refs.current[index] = element }} id={`${id}-tab-${index}`} role="tab" aria-selected={selected === index} aria-controls={`${id}-panel`} tabIndex={selected === index ? 0 : -1} onClick={() => onChange(index)} onKeyDown={event => keyboard(event, index)}>{label}</button>)}</div>
}
export function RecordTimeline() {
  return <div className="cf-records"><p className="cf-muted cf-caption">示例记录 · 非实际生产数据</p><ol>{records.map(record => <li key={record.title}><h3>{record.title}</h3><p>{record.description}</p><span>示例记录</span></li>)}</ol></div>
}
export function GrowthTimeline() {
  return <section className="cf-growth" aria-label="示例生长跟踪"><h3>生长跟踪 · 示例时间线</h3><ol>{['萌芽', '花期', '膨果', '采收'].map(stage => <li key={stage}><span/>{stage}</li>)}</ol><RecordTimeline/><p className="cf-camera-note"><Camera size={19}/>摄像头尚未接入，请在地块详情查看产地影像。</p></section>
}
