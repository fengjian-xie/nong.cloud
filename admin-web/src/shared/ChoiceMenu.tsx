import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import '../../../miniapp/preview/choice-menu.css'

type Option = { value: string; label: string }
type Props = { label: string; value: string; options: readonly Option[]; onChange: (value: string) => void }

/** A single-choice listbox. The identity grant remains the caller's responsibility. */
export function ChoiceMenu({ label, value, options, onChange }: Props) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = Math.max(0, options.findIndex(option => option.value === value))
  const current = options[active]
  const optionId = (index: number) => `${id}-option-${index}`

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  useEffect(() => {
    const option = document.getElementById(`${id}-option-${active}`), list = panel.current
    if (!open || !option || !list) return
    const top = option.offsetTop, bottom = top + option.offsetHeight
    if (top < list.scrollTop) list.scrollTop = top
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
  }, [active, id, open])

  const choose = (next: string) => {
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
    onChange(next)
  }
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key
    if (key === 'Escape') { if (open) { event.preventDefault(); setOpen(false); trigger.current?.focus() }; return }
    if (key === 'Tab') { setOpen(false); return }
    if (!options.length) return
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
      event.preventDefault()
      setActive(key === 'Home' ? 0 : key === 'End' ? options.length - 1 : !open ? selected : (active + (key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
      setOpen(true)
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault()
      if (open && current) choose(current.value)
      else { setActive(selected); setOpen(true) }
    }
  }
  return <div ref={root} className={`xq-choice${open ? ' open' : ''}`} onKeyDown={keyDown} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button ref={trigger} type="button" className="xq-choice-trigger" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-options` : undefined} aria-activedescendant={open && current ? optionId(active) : undefined} disabled={!options.length} onClick={() => { setActive(selected); setOpen(!open) }}>{options.find(option => option.value === value)?.label || '请选择'}</button>
    {open && <div ref={panel} id={`${id}-options`} className="xq-choice-panel" role="listbox" aria-label={label}>{options.map((option, index) => <button key={option.value} id={optionId(index)} type="button" role="option" tabIndex={-1} aria-selected={option.value === value} className={`xq-choice-option${index === active ? ' is-active' : ''}`} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(option.value)}>{option.label}</button>)}</div>}
  </div>
}
