import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

export function ContentDialog({ title, onClose, children, notice }: { title: string; onClose: () => void; children: ReactNode; notice?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const label = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    const dialog = ref.current
    if (dialog?.showModal) dialog.showModal()
    else dialog?.setAttribute('open', '')
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close?.()
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  return <dialog ref={ref} className="xq-content-dialog" aria-labelledby={label} onCancel={event => { event.preventDefault(); onClose() }} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
    if (event.key !== 'Tab') return
    const elements = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]') ?? [])]
    const first = elements[0], last = elements.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }}>
    <header><h2 id={label}>{title}</h2><button className="icon-button" aria-label="关闭窗口" onClick={onClose}><X size={20}/></button></header>
    <div className="xq-content-dialog-body">{notice ? <p className="sys-dialog-feedback" aria-live="polite">{notice}</p> : null}{children}</div>
  </dialog>
}
