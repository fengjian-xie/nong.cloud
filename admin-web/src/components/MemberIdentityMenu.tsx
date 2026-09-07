import { BadgeCheck } from 'lucide-react'
import './MemberIdentityMenu.css'

export function MemberIdentityMenu({ identities }: { identities: string }) {
  const items = [...new Set(identities.split('、').filter(Boolean))]
  return <div className="identity-certifications" role="group" aria-label="身份认证">
    {items.map((identity) => <span className="status-chip positive identity-certification" key={identity} title={`${identity}身份认证`}><BadgeCheck size={15} aria-hidden="true" /><span>{identity}</span></span>)}
  </div>
}
