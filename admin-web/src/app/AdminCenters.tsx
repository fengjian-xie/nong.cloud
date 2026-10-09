import { lazy, Suspense } from 'react'
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { adminCenters, centerPath, mergeLegacyLocation } from './centers'
import { DashboardPage } from '../pages/DashboardPage'
import { MembersPage } from '../pages/MembersPage'
import { MemberDetailPage } from '../pages/MemberDetailPage'
import { PlotsPage } from '../pages/PlotsPage'
import { PlotDetailPage } from '../pages/PlotDetailPage'
import { OperationsPage } from '../pages/OperationsPage'
import { ServiceDetailPage } from '../pages/ServiceDetailPage'
import { TaskDetailPage } from '../pages/TaskDetailPage'
import { SystemSettingsPage } from '../pages/SystemSettingsPage'
import { useAuth } from '../auth/AuthContext'
import { makeActor } from '../system/model'
import { platform } from '../platform'
import './centers.css'

const SystemPage = lazy(() => import('../system/SystemManagementPage'))
const Cards = lazy(() => import('../farm/RecordPages').then(m => ({ default: m.CardsPage })))
const Records = lazy(() => import('../farm/RecordPages').then(m => ({ default: m.RecordsPage })))
const Production = lazy(() => import('../farm/ProductionPages').then(m => ({ default: m.ProductionPage })))
const Soil = lazy(() => import('../farm/ProductionPages').then(m => ({ default: m.SoilPage })))
const Costs = lazy(() => import('../farm/ProductionPages').then(m => ({ default: m.CostPage })))
const Maturity = lazy(() => import('../farm/MapPages').then(m => ({ default: m.MaturityPage })))
const Resources = lazy(() => import('../farm/MapPages').then(m => ({ default: m.ResourcesPage })))
const Farms = lazy(() => import('../farm/MapPages').then(m => ({ default: m.CloudFarmsPage })))
const Inventory = lazy(() => import('../farm/CommercePages').then(m => ({ default: m.InventoryPage })))
const Procurement = lazy(() => import('../farm/CommercePages').then(m => ({ default: m.ProcurementPage })))
const Merchants = lazy(() => import('../farm/CommercePages').then(m => ({ default: m.MerchantsPage })))
const Sharing = lazy(() => import('../farm/MerchantSharingPanel').then(m => ({ default: m.MerchantSharingPanel })))
const Verification = lazy(() => import('../farm/TracePages').then(m => ({ default: m.VerificationPage })))
const Trace = lazy(() => import('../farm/TracePages').then(m => ({ default: m.TracePage })))
const Support = lazy(() => import('../support/SupportCenter'))
const Value = lazy(() => import('../value/ValueWorkspace'))
const Api = lazy(() => import('../openapi/OpenApiPage'))

function ViewTabs({ options }: { options: readonly { id: string; label: string }[] }) {
  const [params, setParams] = useSearchParams()
  const active = options.some(v => v.id === params.get('view')) ? params.get('view') : options[0].id
  return <nav className="center-view-tabs" aria-label="同一业务的不同视图">{options.map(v => <button key={v.id} aria-pressed={active === v.id} onClick={() => { const next = new URLSearchParams(params); next.set('view', v.id); setParams(next) }}>{v.label}</button>)}</nav>
}
function UnifiedView({ kind }: { kind: 'supply' | 'inventory' | 'economics' }) {
  const [params] = useSearchParams()
  const view = params.get('view')
  const options = kind === 'supply' ? [{ id: 'audit', label: '供需审核' }, { id: 'map', label: '成熟一览' }, { id: 'calendar', label: '供货日历' }] : kind === 'inventory' ? [{ id: 'stock', label: '批次与库存订单' }, { id: 'grades', label: '分级货源匹配' }] : [{ id: 'cost', label: '生产成本参考' }, { id: 'income', label: '销售方案与净收益' }]
  return <><ViewTabs options={options}/><p className="center-boundary">共用业务入口；现有演示测算、草稿和台账来源尚未统一到后端。切换视图不会搬移、重复记账或删除历史数据。</p>{kind === 'supply' ? view === 'map' ? <Maturity/> : view === 'calendar' ? <Value viewId="calendar" managed/> : <OperationsPage module="supply"/> : kind === 'inventory' ? view === 'grades' ? <Value viewId="grades" managed/> : <Inventory/> : view === 'income' ? <Value viewId="income" managed/> : <Costs/>}</>
}
function Finance() {
  const { session } = useAuth()
  const permissions = session ? makeActor(session.user).permissions : []
  if (!permissions.includes('merchants.read')) return <section className="panel center-empty"><h1>当前岗位无财务查看权限</h1><p>业务身份切换不会获得财务权限。请由授权财务岗位处理。</p></section>
  return <><h1>财务与结算</h1><p className="center-boundary">本机演示。申请、审核与执行分别授权，真实支付、退款和分账仍未接入。</p>{permissions.includes('sharing.configure') ? <Sharing/> : <section className="panel center-empty"><p>当前岗位仅可查看财务说明，无分账配置权限。</p></section>}</>
}
function Content({ center, section }: { center: string; section: string }) {
  if (center === 'subjects') return section === 'members' ? <MembersPage/> : section === 'centers' ? <SystemPage view="centers"/> : <SystemPage view="identities"/>
  if (center === 'production') {
    switch (section) {
      case 'plots': return <PlotsPage/>
      case 'seasons': return <Production/>
      case 'records': return <Records/>
      case 'season-records': return <Value viewId="stories" managed/>
      case 'cards': return <Cards/>
      case 'soil': return <Soil/>
      case 'economics': return <UnifiedView kind="economics"/>
      default: return <Value viewId="history" managed/>
    }
  }
  if (center === 'services') return section === 'orders' ? <OperationsPage module="services"/> : <Resources/>
  if (center === 'trade') {
    switch (section) {
      case 'supply': return <UnifiedView kind="supply"/>
      case 'inventory': return <UnifiedView kind="inventory"/>
      case 'procurement': return <Procurement/>
      case 'passport': return <Value viewId="passport" managed/>
      case 'farms': return <Farms/>
      default: return <Merchants/>
    }
  }
  if (center === 'quality') return section === 'verification' ? <Verification/> : <Trace/>
  if (center === 'customer') return section === 'support' ? <Support/> : <SystemPage view={section === 'news' ? 'news' : 'social'}/>
  if (center === 'finance') return <Finance/>
  if (center === 'platform') {
    switch (section) {
      case 'permissions': return <SystemPage view="permissions"/>
      case 'logs': return <SystemPage view="logs"/>
      case 'integrations': return <><p className="center-boundary">乡桥连接外部平台：同步、授权与回执。开发者访问乡桥的应用授权在“开放应用管理”中处理。</p><SystemPage view="integrations"/></>
      case 'api': return <><p className="center-boundary">开发者应用演示；正式管理审批与外部开发者权限必须分开。<a href={platform.api} target="_blank" rel="noopener noreferrer">在新页面打开API文档 ↗</a></p><Api/></>
      case 'config': return <OperationsPage module="config"/>
      default: return <SystemSettingsPage initialGroup="locations"/>
    }
  }
  return <DashboardPage/>
}

export function AdminCenterPage() {
  const { centerId, section } = useParams()
  const center = adminCenters.find(c => c.id === centerId)
  if (!center) return <section className="panel center-empty"><h1>没有这个业务中心</h1><Link to="/">返回运营工作台</Link></section>
  if (!section) return <Navigate to={centerPath(center.id)} replace/>
  if (!center.tabs.some(tab => tab.id === section)) return <section className="panel center-empty"><h1>没有这个业务页面</h1><Link to={centerPath(center.id)}>返回{center.name}</Link></section>
  return <div className="admin-center"><header className="center-heading"><div><span>乡桥管理后台 / {center.name}</span><p>{center.description}</p></div><small>福安演示 · 后端联动待接入</small></header><nav className="center-section-tabs" aria-label={`${center.name}业务目录`}>{center.tabs.map(tab => <Link key={tab.id} aria-current={section === tab.id ? 'page' : undefined} to={centerPath(center.id, tab.id)}>{tab.label}</Link>)}</nav><Suspense fallback={<div className="app-boot">正在打开业务页面…</div>}><Content key={`${center.id}:${section}`} center={center.id} section={section}/></Suspense></div>
}
export function LegacyAdminRedirect() {
  const location = useLocation()
  const target = mergeLegacyLocation(location.pathname, location.search, location.hash)
  return target ? <Navigate to={target} replace/> : <section className="panel center-empty"><h1>页面不存在或尚未开放</h1><Link to="/">返回运营工作台</Link></section>
}
export function AdminOverview() {
  const [params] = useSearchParams()
  return <><ViewTabs options={[{ id: 'dashboard', label: '运营概况与待办' }, { id: 'followup', label: '协同与缺项提醒' }]}/><Suspense fallback={<div className="app-boot">正在加载运营待办…</div>}>{params.get('view') === 'followup' ? <Value viewId="collaboration" managed/> : <DashboardPage/>}</Suspense></>
}
export { MemberDetailPage, PlotDetailPage, ServiceDetailPage, TaskDetailPage }
