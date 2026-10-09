import {
  Bell, ChevronLeft, ChevronRight, ClipboardCheck, LayoutDashboard, LogOut, MapPinned,
  Menu, ShieldCheck, Sprout, Store, UsersRound, X, CreditCard, BadgeCheck, Headphones,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useFarm } from '../farm/FarmProvider'
import { BrandLockup, BrandMark } from '../brand/BrandLockup'
import { adminCenters } from '../app/centers'
import { platform } from '../platform'

const centerIcons = { overview: LayoutDashboard, subjects: UsersRound, production: Sprout, services: ClipboardCheck, trade: Store, quality: BadgeCheck, customer: Headphones, finance: CreditCard, platform: ShieldCheck }
const navigationGroups = [{ label: '九个业务中心', items: adminCenters.map(center => ({ to: center.id === 'overview' ? '/' : `/manage/${center.id}`, label: center.name, icon: centerIcons[center.id] })) }]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, logout, warning } = useAuth()
  const [open, setOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const { state } = useFarm()
  const pending = state.records.filter(r => r.status === '待核验').length

  return (
    <div className={`app-shell farm-shell${compact ? ' sidebar-compact' : ''}`}>
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="brand">
          <div className="vi-sidebar-full"><BrandLockup reverse stacked context="管理后台 · 福安运营中心"/></div>
          <div className="vi-sidebar-compact"><BrandMark reverse/></div>
          <button className="icon-button sidebar-close" onClick={() => setOpen(false)} aria-label="关闭菜单"><X /></button>
        </div>
        <nav className="side-nav" aria-label="主导航">
          {navigationGroups.map(group => <div className="farm-nav-group" key={group.label}><div className="farm-nav-label">{group.label}</div>{group.items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/' || to === '/settings' || to === '/services' || to === '/production'} title={label} aria-label={label} onClick={() => setOpen(false)}>
              <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}</div>)}
        </nav>
        <div className="side-foot">
          <div className="tenant-mini"><span>一期试点 · 免平台服务费</span><strong>福安 · 赛岐镇狮子头村</strong></div>
          <button className="side-collapse" onClick={() => { setCompact(c => !c); setOpen(false) }} aria-label={compact ? '展开菜单' : '收起菜单'} aria-expanded={!compact}>{compact ? <ChevronRight size={17}/> : <ChevronLeft size={17}/>}<span>{compact ? '展开' : '收起菜单'}</span></button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => { setCompact(false); setOpen(true) }} aria-label="打开菜单"><Menu /></button>
          <div className="topbar-context"><MapPinned size={18} /><strong>福安市</strong><span>tenant: fuan</span></div>
          <div className="topbar-actions">
            <Link to="/workspaces" className="secondary-button portal-header-entry">角色工作台</Link>
            <a href={platform.api} target="_blank" rel="noopener noreferrer" className="secondary-button portal-header-entry">API文档 ↗</a>
            <Link to="/records?status=待核验" className="icon-button notification" aria-label={`查看${pending}条待核验记录`} title={`${pending}条记录待核验`}><Bell size={19} />{pending > 0 && <span/>}</Link>
            <div className="user-summary"><div className="avatar">陈</div><span><strong>{session?.user.name}</strong><small>{session?.user.role}</small></span></div>
            <button className="logout-button" onClick={logout} aria-label="退出登录" title="退出登录"><LogOut size={17} /><span>退出登录</span></button>
          </div>
        </header>
        <main className="content">{warning ? <div className="farm-warning" role="status">{warning}</div> : null}{children}</main>
      </div>
      {open ? <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="关闭菜单遮罩" /> : null}
    </div>
  )
}
