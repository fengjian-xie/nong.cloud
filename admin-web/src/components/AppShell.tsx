import {
  Bell, ChevronLeft, ClipboardCheck, LayoutDashboard, LogOut, MapPinned,
  Menu, Settings2, ShieldCheck, Sprout, Store, UserCog, UsersRound, X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const navigation = [
  { to: '/', label: '运营工作台', icon: LayoutDashboard },
  { to: '/members', label: '会员与主体', icon: UsersRound },
  { to: '/plots', label: '地块核验', icon: MapPinned },
  { to: '/services', label: '服务调度', icon: ClipboardCheck },
  { to: '/supply', label: '供需审核', icon: Store },
  { to: '/config', label: '参数配置', icon: Settings2 },
  { to: '/settings', label: '系统设置', icon: UserCog },
  { to: '/audit', label: '审计与提权', icon: ShieldCheck },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Sprout size={23} strokeWidth={1.8} /></div>
          <div><strong>福安农事</strong><span>运营中心</span></div>
          <button className="icon-button sidebar-close" onClick={() => setOpen(false)} aria-label="关闭菜单"><X /></button>
        </div>
        <nav className="side-nav" aria-label="主导航">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>
              <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="tenant-mini"><span>一期范围</span><strong>福安市 · 350981</strong></div>
          <button className="side-collapse" aria-label="收起菜单"><ChevronLeft size={17} /> 收起菜单</button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setOpen(true)} aria-label="打开菜单"><Menu /></button>
          <div className="topbar-context"><MapPinned size={18} /><strong>福安市</strong><span>tenant: fuan</span></div>
          <div className="topbar-actions">
            <button className="icon-button notification" aria-label="通知"><Bell size={19} /><span /></button>
            <div className="user-summary"><div className="avatar">陈</div><span><strong>{session?.user.name}</strong><small>{session?.user.role}</small></span></div>
            <button className="logout-button" onClick={logout} aria-label="退出登录" title="退出登录"><LogOut size={17} /><span>退出登录</span></button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      {open ? <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="关闭菜单遮罩" /> : null}
    </div>
  )
}
