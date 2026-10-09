import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AppShell } from '../components/AppShell'
import { LoginPage } from '../pages/LoginPage'
import { AdminCenterPage, AdminOverview, LegacyAdminRedirect, MemberDetailPage, PlotDetailPage, ServiceDetailPage, TaskDetailPage } from './AdminCenters'

const PortalHub = lazy(() => import('../portals/PortalApp').then(m => ({ default: m.PortalHub })))
const PortalApp = lazy(() => import('../portals/PortalApp'))

function ProtectedWorkspace() {
  const { session, restoring } = useAuth()
  if (restoring) return <div className="app-boot">正在恢复会话…</div>
  if (!session) return <Navigate to="/login" replace />
  return <Suspense fallback={<div className="app-boot">正在加载角色工作台…</div>}><PortalApp/></Suspense>
}

function ProtectedApp() {
  const { session, restoring } = useAuth()
  if (restoring) return <div className="app-boot">正在恢复福安运营会话…</div>
  if (!session) return <Navigate to="/login" replace />

  return (
    <AppShell>
      <Suspense fallback={<div className="app-boot">正在加载乡桥农事模块…</div>}><Routes>
        <Route path="/" element={<AdminOverview />} />
        <Route path="/manage/:centerId/:section?" element={<AdminCenterPage />} />
        <Route path="/manage/subjects/members/:memberId" element={<MemberDetailPage />} />
        <Route path="/manage/production/plots/:plotId" element={<PlotDetailPage />} />
        <Route path="/manage/services/orders/:serviceId" element={<ServiceDetailPage />} />
        <Route path="/manage/overview/tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="/workspaces" element={<PortalHub />} />
        <Route path="*" element={<LegacyAdminRedirect />} />
      </Routes></Suspense>
    </AppShell>
  )
}

export function App() {
  const { session } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/workspace/:role/*" element={<ProtectedWorkspace/>} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  )
}
