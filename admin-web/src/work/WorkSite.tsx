import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { FarmProvider } from '../farm/FarmProvider'
import { getRole, rolePath } from '../portals/config'
import type { RoleId } from '../portals/config'
import { WorkLogin } from './WorkLogin'
import { clearWorkDemoData, getDemoAccount, hasIdentity, loadDemoSession, saveDemoSession, workDescription, workTitle } from './site'
import type { DemoAccount, DemoSession } from './site'
import './work.css'
import { connectedMode } from '../connected/client'
import ConnectedWorkspace from '../connected/ConnectedWorkspace'

const PortalApp = lazy(() => import('../portals/PortalApp'))

function DemoWorkspace({ session, onExit, onRoleChange, warning }: { session?: DemoSession; onExit: () => void; onRoleChange: (role: RoleId) => void; warning: string }) {
  const { role: requested } = useParams()
  const account = getDemoAccount(session?.accountId)
  if (!session || !account) return <Navigate to="/login" replace/>
  if (!getRole(requested)) return <Navigate to="/login" replace/>
  if (!requested || !hasIdentity(account, requested)) return <main className="work-unavailable"><h1>当前账号没有此身份</h1><p>请使用已绑定的工作身份。此演示不能替代服务端权限校验。</p><Link to={rolePath(session.activeRole)}>返回当前工作台</Link></main>
  if (requested !== session.activeRole) return <Navigate to={rolePath(session.activeRole)} replace/>
  return <><div className="work-session-warning" role="status" hidden={!warning}>{warning}</div><Suspense fallback={<div className="app-boot">正在加载主体工作台…</div>}><PortalApp onExit={onExit} onRoleChange={onRoleChange} availableRoleIds={account.roles} accountLabel={account.name} accountId={account.id}/></Suspense></>
}

export default function WorkSite() { return connectedMode ? <ConnectedWorkspace/> : <DemoWorkSite/> }
function DemoWorkSite() {
  const [initial] = useState(loadDemoSession)
  const [session, setSession] = useState<DemoSession | undefined>(initial.session)
  const [warning, setWarning] = useState(initial.warning)
  const navigate = useNavigate()
  useEffect(() => {
    const title = document.title
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const description = meta?.content
    document.title = workTitle
    if (meta) meta.content = workDescription
    return () => { document.title = title; if (meta && description !== undefined) meta.content = description }
  }, [])
  function enter(account: DemoAccount) { const next: DemoSession = { version: 2, accountId: account.id, activeRole: account.roles[0] }; setWarning(saveDemoSession(next)); setSession(next); navigate(rolePath(next.activeRole)) }
  function changeIdentity(role: RoleId) {
    const account = getDemoAccount(session?.accountId)
    if (!session || !account || !hasIdentity(account, role)) return
    const next = { ...session, activeRole: role }
    setWarning(saveDemoSession(next)); setSession(next); navigate(rolePath(role))
  }
  function exit() { const cacheWarning = clearWorkDemoData(session?.accountId); setWarning(saveDemoSession() || cacheWarning); setSession(undefined); navigate('/login') }
  return <FarmProvider key={session?.accountId || 'guest'} storageKey={`xiangqiao:work-demo:farm:${session?.accountId || 'guest'}`}><Routes>
    <Route path="/" element={<Navigate to="/login" replace/>}/>
    <Route path="/login" element={<WorkLogin initialAccount={session?.accountId} onEnter={enter} warning={warning}/>}/>
    <Route path="/workspaces" element={<Navigate to="/login" replace/>}/>
    <Route path="/workspace/:role/*" element={<DemoWorkspace session={session} onExit={exit} onRoleChange={changeIdentity} warning={warning}/>}/>
    <Route path="*" element={<Navigate to="/login" replace/>}/>
  </Routes></FarmProvider>
}
