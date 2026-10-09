import './brand.css'

type BrandLockupProps = { context?: string; domain?: string; reverse?: boolean; stacked?: boolean }

/** Use the supplied VI lockup unchanged; product names live outside the logo. */
export function BrandLockup({ context, domain, reverse = false, stacked = false }: BrandLockupProps) {
  return <span className={`vi-lockup${reverse ? ' vi-reverse' : ''}${stacked ? ' vi-stacked' : ''}`}>
    <img className="vi-lockup-image" src={`${import.meta.env.BASE_URL}brand/xiangqiao-vi-lockup${reverse ? '-reverse' : ''}.svg`} alt="乡桥农业 · 连接乡土，共享丰收" width="660" height="200"/>
    {context ? <span className="vi-site-context"><strong>{context}</strong>{domain ? <small>{domain}</small> : null}</span> : null}
  </span>
}

export function BrandMark({ reverse = false }: { reverse?: boolean }) {
  return <svg className="vi-mark" viewBox="0 0 200 200" width="52" height="52" aria-hidden="true" focusable="false">
    <path d="M 90 25 L 42 80 L 118 44" fill="none" stroke={reverse ? '#F4F2EA' : '#0F3D2E'} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M 120 47 L 52 112 L 150 70" fill="none" stroke={reverse ? '#F4F2EA' : '#3E9B5F'} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M 150 69 L 62 144 L 178 96" fill="none" stroke="#E8B54A" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
}
