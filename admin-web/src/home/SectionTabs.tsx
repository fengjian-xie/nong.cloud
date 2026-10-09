import { useRef, type KeyboardEvent } from 'react'

export function SectionTabs({ id, label, items, active, onChange }: { id: string; label: string; items: readonly string[]; active: number; onChange: (index: number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  function key(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number
    if (event.key === 'ArrowRight') next = (index + 1) % items.length
    else if (event.key === 'ArrowLeft') next = (index + items.length - 1) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else return
    event.preventDefault()
    onChange(next)
    refs.current[next]?.focus()
  }
  return <div className="xq-section-tabs" role="tablist" aria-label={label}>{items.map((item, index) => <button id={`${id}-tab-${index}`} key={item} ref={element => { refs.current[index] = element }} role="tab" type="button" aria-selected={index === active} aria-controls={`${id}-panel`} tabIndex={index === active ? 0 : -1} onClick={() => onChange(index)} onKeyDown={event => key(event, index)}>{item}</button>)}</div>
}
