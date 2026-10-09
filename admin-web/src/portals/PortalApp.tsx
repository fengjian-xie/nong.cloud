import { ArrowLeft, ArrowUpRight, CreditCard, FlaskConical, HeartHandshake, LayoutDashboard, Menu, Package, ShieldCheck, ShoppingBasket, Sprout, Store, Tractor, UsersRound, Warehouse, Wrench, X } from 'lucide-react'
import { Suspense, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Panel, Stats, Tag } from '../farm/ui'
import { useFarm } from '../farm/FarmProvider'
import { getRole, hasModule, moduleLabels, rolePath, roles } from './config'
import type { Role } from './config'
import { publicOffers, scopedBatches, scopedJobs, scopedPlots } from './model'
import { PortalProvider, usePortal } from './PortalProvider'
import { RolePage } from './RolePages'
import { farmerFeePolicy } from '../pricing'
import { BrandLockup } from '../brand/BrandLockup'
import './portals.css'
import { SupportCenter } from '../support/SupportCenter'
import { businessGroups, businessEntryPath } from './businessGroups'
import '../app/centers.css'
import { ChoiceMenu } from '../shared/ChoiceMenu'

const icons = { sprout: Sprout, users: UsersRound, basket: ShoppingBasket, store: Store, tractor: Tractor, tools: Wrench, warehouse: Warehouse, package: Package, flask: FlaskConical, heart: HeartHandshake, shield: ShieldCheck }

export function PortalHub() {
  return <div className="farm-page portal-hub"><div className="page-heading"><div><div className="farm-eyebrow">WORK.NONG.CLOUD · 多身份协同</div><h1>一个账号，多种身份，共用业务工作台。</h1><p>围绕一张农事卡，把生产、服务与产销接起来。{farmerFeePolicy}身份决定操作范围，不再为每个角色另建一套后台。</p></div></div>
    <div className="farm-demo">演示身份选择器 · 以下角色为固定示例，不改变登录账号的真实权限；正式环境由服务端分配角色。</div>
    <div className="portal-role-grid">{roles.map(role => { const Icon = icons[role.icon]; return <Link key={role.id} to={rolePath(role.id)} className="panel portal-role-card"><div className="portal-card-top"><span className="portal-role-icon"><Icon size={25}/></span><Tag tone="gray">{role.group}</Tag></div><h2>{role.name}后台</h2><p>{role.description}</p><small>{role.scope}</small><span className="portal-enter">进入工作台 <ArrowUpRight size={17}/></span></Link> })}</div>
    <Panel title="同一条产业链，不同的数据边界" caption="乡桥农业有限公司 · 福安市乡桥农事综合服务有限公司"><div className="portal-flow">{['农户记录与供货', '合作社协同', '服务商履约', '采购商找货', '消费者看生产'].map((text, i) => <div key={text}><span>0{i + 1}</span><strong>{text}</strong><small>{i === 4 ? 'nc.nong.cloud · 农场演示' : 'work.nong.cloud · 主体工作台'}</small></div>)}</div></Panel>
  </div>
}

type WorkspaceActions = { onExit?: () => void; onRoleChange?: (role: Role['id']) => void; availableRoleIds?: readonly Role['id'][]; accountLabel?: string; accountId?: string }

function PortalShell({ role, children, onExit, onRoleChange, availableRoleIds, accountLabel }: { role: Role; children: React.ReactNode } & WorkspaceActions) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { notice, warning } = usePortal()
  const Icon = icons[role.icon]
  const available = availableRoleIds ? roles.filter(r => availableRoleIds.includes(r.id)) : roles
  return <div className="app-shell farm-shell portal-shell"><aside className={`sidebar ${open ? 'is-open' : ''}`}><div className="brand"><BrandLockup reverse stacked context={`${role.name}工作台`}/><button className="icon-button sidebar-close" aria-label="关闭菜单" onClick={() => setOpen(false)}><X/></button></div>
    <div className="portal-identity"><Icon size={20}/><div><strong>{role.actor}</strong><small>福安 · 赛岐试点 / 演示身份</small></div></div>
    <nav className="side-nav" aria-label="角色业务导航"><NavLink to={rolePath(role.id)} end onClick={() => setOpen(false)}><LayoutDashboard size={19}/><span>工作台概览</span></NavLink>{businessGroups(role).map(group => <div className="portal-business-group" key={group.id}><div className="farm-nav-label">{group.title}</div>{group.entries.map(entry => <NavLink key={entry.id} to={businessEntryPath(role, entry.id)} className={() => entry.variants.some(v => businessEntryPath(role, v) === pathname) ? 'active' : ''} onClick={() => setOpen(false)}><span className="portal-nav-dot"/><span>{entry.title}</span></NavLink>)}</div>)}</nav>
    <div className="side-foot"><Link className="portal-admin-back" to={`${rolePath(role.id)}/help`}>帮助与呼叫中心 →</Link><div className="tenant-mini"><span>{['farmer', 'cooperative', 'family'].includes(role.id) ? '免平台服务费 · 农事卡另收费' : '产业带协同 · 服务有边界'}</span><strong>乡桥农事记录体系</strong></div><Link className="portal-admin-back" to={onExit ? '/login' : '/workspaces'}><ArrowLeft size={16}/>{onExit ? '更换演示身份' : '全部角色 / 运营后台'}</Link></div></aside>
    <div className="app-main"><header className="topbar"><button className="icon-button mobile-menu" aria-label="打开菜单" onClick={() => setOpen(true)}><Menu/></button><div className="topbar-context"><Icon size={18}/><strong>{role.name}后台</strong><span>福安市</span></div><div className="portal-switch"><span>{onExit ? '工作身份' : '演示角色'}</span><ChoiceMenu label={onExit ? '切换工作身份' : '切换演示角色'} value={role.id} options={available.map(r => ({ value: r.id, label: r.name }))} onChange={value => { const next = available.find(r => r.id === value); if (!next) return; if (onRoleChange) onRoleChange(next.id); else navigate(rolePath(next.id)) }}/></div>{onExit ? <button className="work-exit" onClick={onExit}>退出演示</button> : null}</header>
    <main className="content"><div className="portal-scope"><span>{accountLabel ? `演示账号：${accountLabel} · 当前身份：${role.name}` : '前端演示 · 本机保存，无真实付款或对外发布'}</span><small>数据范围：{role.scope}。本机演示，无真实付款；非正式身份授权。</small></div>{warning && <div className="farm-warning" role="alert">{warning}</div>}{notice && <div className="farm-feedback" role="status">{notice}</div>}{children}</main></div>{open && <button className="sidebar-scrim" aria-label="关闭菜单遮罩" onClick={() => setOpen(false)}/>}</div>
}

function Overview({ role }: { role: Role }) {
  const { state: farm } = useFarm()
  const { state } = usePortal()
  const plots = scopedPlots(farm, state, role.id)
  const jobs = scopedJobs(state, role.id)
  const batches = scopedBatches(farm, role.id)
  const offers = publicOffers(farm, state)
  const metrics = role.id === 'buyer' ? [
    { label: '公开货源', value: offers.length, detail: '仅供货人主动发布' }, { label: '意向可供量', value: `${offers.reduce((s, p) => s + p.quantity, 0).toLocaleString()} kg`, detail: '预测不是实收产量' }, { label: '我的采购需求', value: state.demands.filter(d => d.actor === 'buyer' && d.status === '征集中').length, detail: '意向不等于已成交' }, { label: '查看方案', value: state.memberships.mode, detail: state.memberships.active ? '示例权益已开通' : '未实际付款' },
  ] : role.id === 'supplier' ? [
    { label: '本店销售凭据', value: state.sales.length, detail: '仅本机登记的模拟交易' }, { label: '关联农户', value: new Set(state.sales.map(s => s.customer)).size, detail: 'NFC识别仅返回必要信息' }, { label: '登记金额', value: `¥${state.sales.reduce((s, p) => s + p.amount, 0).toFixed(2)}`, detail: '非实际支付流水' }, { label: '真实NFC设备', value: '未连接', detail: '此版本使用模拟识别' },
  ] : role.id === 'lab' ? [
    { label: '受托样品', value: state.samples.length, detail: '仅本机构委托' }, { label: '待采样', value: state.samples.filter(s => s.status === '待采样').length, detail: '完成采样后提交报告' }, { label: '待核验报告', value: state.samples.filter(s => s.status === '待运营核验').length, detail: '机构不能自我核验' }, { label: '报告接入', value: '演示', detail: '附件只保存元数据' },
  ] : ['warehouse', 'processor'].includes(role.id) ? [
    { label: '关联批次', value: batches.length, detail: role.id === 'warehouse' ? '保管权不等于货权' : '仅本车间货权' }, { label: '账面库存', value: `${batches.reduce((s, b) => s + b.quantity - b.sold, 0).toLocaleString()} kg`, detail: '含锁定量，非可售量' }, { label: '锁定数量', value: `${batches.reduce((s, b) => s + b.reserved, 0)} kg`, detail: '来自库存预订订单' }, { label: '运营遥测', value: '未接入', detail: '不能用电量推算库存' },
  ] : ['machine', 'team', 'protection'].includes(role.id) ? [
    { label: '指派订单', value: jobs.length, detail: '不会展示其他服务商订单' }, { label: '待接单', value: jobs.filter(j => j.status === '待接单').length, detail: '接受后方可开始作业' }, { label: '待委托方验收', value: jobs.filter(j => j.status === '待验收').length, detail: '服务商不能自验收' }, { label: '自有服务资源', value: state.assets.filter(a => a.role === role.id).length, detail: '可更新资源状态' },
  ] : [
    { label: role.id === 'cooperative' ? '授权社员地块' : '可查看地块', value: plots.length, detail: '非全县数据' }, { label: '种植面积', value: `${plots.reduce((s, p) => s + p.area, 0).toFixed(1)} 亩`, detail: '示例档案，不是500亩目标' }, { label: role.id === 'family' ? '代办权限' : '我的待办服务', value: role.id === 'family' ? (state.family.configure ? '可代办卡片' : '仅授权查看') : jobs.filter(j => !['已完成', '已取消'].includes(j.status)).length, detail: role.id === 'family' ? '由种植户本人管理' : '查看执行与验收进度' }, { label: '生产端服务费', value: '¥0', detail: '不向农户收平台费' },
  ]
  const Icon = icons[role.icon]
  return <div className="farm-page"><section className="portal-hero"><div><div className="farm-eyebrow">乡桥农事 / {role.name}工作台</div><h1>{role.headline}</h1><p>{role.description}</p><Link className="portal-hero-link" to={rolePath(role.id, role.modules[0])}>开始处理{moduleLabels[role.modules[0]]} <ArrowUpRight size={17}/></Link></div><div className="portal-hero-mark"><Icon size={55} strokeWidth={1.2}/><span>{role.actor}</span><small>示例数据基准日 · 2026-08-29</small></div></section><Stats items={metrics}/>
    <div className="portal-overview-grid"><Panel title="今天，从这里开始" caption="按职责进入业务；不是全平台运营权限"><div className="portal-shortcuts">{role.modules.slice(0, 6).map((m, i) => <Link key={m} to={rolePath(role.id, m)}><span>0{i + 1}</span><div><strong>{moduleLabels[m]}</strong><small>{m === 'cards' ? 'A / B / C 作业配置与同步' : m === 'services' ? '委托、作业与验收状态' : m === 'stock' ? '批次、可用量与库存锁定' : '只查看与处理授权范围内的业务'}</small></div><ArrowUpRight size={18}/></Link>)}</div></Panel><Panel title="业务边界" caption="把记录做扎实，把授权说清楚"><div className="portal-boundary"><Tag>{role.group}</Tag><h3>{role.scope}</h3><p>{role.id === 'family' ? '默认可查看；卡片设置和记录整理需要种植户额外授权。撤销查看后，不再显示家庭生产信息。' : role.id === 'buyer' ? '货源日期、数量是种植方的预测与意向。农户成本、原始定位、家庭授权均不提供给采购商。' : '当前为本地前端原型。正式上线必须由服务端校验账号、租户、数据归属和操作权限。'}</p><div className="portal-boundary-note"><CreditCard size={20}/><span>农事卡与农资、农机、农服衔接<br/><small>GPS / 蓝牙 / NFC · 实物协议待接入</small></span></div><Link to="/workspaces">查看角色协作关系 →</Link></div></Panel></div>
  </div>
}

function RoleWorkspace(actions: WorkspaceActions) {
  const { role: roleId, '*': module } = useParams()
  const role = getRole(roleId)
  if (!role) return <div className="portal-invalid"><h1>没有这个角色工作台</h1><Link to="/workspaces">返回全部角色</Link></div>
  const entry = businessGroups(role).flatMap(g => g.entries).find(e => e.variants.includes(module as typeof e.id))
  const feedback = module === 'value-feedback' && hasModule(role, module)
  return <PortalShell key={role.id} role={role} {...actions}>{!module ? <Overview role={role}/> : module === 'help' || feedback ? <SupportCenter key={`${actions.accountId || 'admin-preview'}:${role.id}`} owner={{accountId:actions.accountId || 'admin-preview',identityId:role.id,label:role.name + '（演示）'}}/> : hasModule(role, module) ? <><p className="center-boundary">同一业务按身份共用入口；内部各演示视图尚未接统一后端，不自动搬移草稿或扩大权限。</p>{entry && entry.variants.length > 1 ? <nav className="portal-business-views" aria-label={`${entry.title}视图`}>{entry.variants.map(v => <Link key={v} aria-current={v === module ? 'page' : undefined} to={businessEntryPath(role, v)}>{moduleLabels[v]}</Link>)}</nav> : null}<Suspense fallback={<p>正在打开产品业务…</p>}><RolePage key={`${role.id}-${module}`} role={role} module={module}/></Suspense></> : <Panel title="此角色没有该业务入口"><p>请使用本角色菜单。前端隐藏入口不等同于服务端鉴权。</p><Link to={rolePath(role.id)}>返回工作台</Link></Panel>}</PortalShell>
}
export default function PortalApp(actions: WorkspaceActions) { return <PortalProvider key={actions.accountId || 'admin-demo'} accountId={actions.accountId}><RoleWorkspace {...actions}/></PortalProvider> }
