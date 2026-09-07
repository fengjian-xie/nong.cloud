import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import wechatPayLogo from '../assets/payments/wechat-pay.svg'
import './PaymentAccountIcons.css'

export type PaymentKey = 'wechatBinding'
const accounts = [
  { key: 'wechatBinding', label: '微信支付', logo: wechatPayLogo, brand: 'wechat-pay' },
] as const

export function PaymentAccountIcons({ payments, onBind }: { payments: Record<PaymentKey, string>; onBind: (key: PaymentKey, label: string) => void }) {
  const [active, setActive] = useState<PaymentKey | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const selected = accounts.find((account) => account.key === active)

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setActive(null)
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !active) return
      root.current?.querySelector<HTMLButtonElement>(`[data-payment-key="${active}"]`)?.focus()
      setActive(null)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape) }
  }, [active])

  return <div className="payment-account-icons" ref={root} role="group" aria-label="支付账户">
    {accounts.map(({ key, label, logo, brand }) => <button type="button" className={`payment-account-icon${payments[key] === '未绑定' ? ' unbound' : ''}${active === key ? ' active' : ''}`} key={key} data-payment-key={key} aria-label={`${label}账户`} title={`${label}：${payments[key]}，点击${payments[key] === '未绑定' ? '添加绑定' : '查看或更换绑定'}`} aria-expanded={active === key} aria-controls={active === key ? 'payment-account-popover' : undefined} onClick={() => setActive((current) => current === key ? null : key)}>
      <span className={`payment-brand-logo ${brand}`}><img src={logo} alt="" /></span>
      <span className="payment-account-label"><strong>{label}</strong><small>{payments[key] === '未绑定' ? '未绑定 · 添加' : '已绑定 · 管理'}</small></span>
    </button>)}
    {selected ? <div id="payment-account-popover" className="payment-account-popover" role="group" aria-label={`${selected.label}绑定信息`}>
      <div><strong>{selected.label}</strong><button type="button" className="icon-button" aria-label="关闭账户信息" onClick={() => { root.current?.querySelector<HTMLButtonElement>(`[data-payment-key="${selected.key}"]`)?.focus(); setActive(null) }}><X size={15} /></button></div>
      <p>{payments[selected.key]}</p><small>演示账户 · 模拟绑定</small>
      <button type="button" className="secondary-button" onClick={() => onBind(selected.key, selected.label)}>{payments[selected.key] === '未绑定' ? '立即绑定' : '更换绑定'}</button>
    </div> : null}
  </div>
}
