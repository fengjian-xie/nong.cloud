import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AppShell } from '../components/AppShell'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { MemberDetailPage } from '../pages/MemberDetailPage'
import { MembersPage } from '../pages/MembersPage'
import { OperationsPage } from '../pages/OperationsPage'
import { PlotDetailPage } from '../pages/PlotDetailPage'
import { PlotsPage } from '../pages/PlotsPage'
import { SystemSettingsPage } from '../pages/SystemSettingsPage'
import { ServiceDetailPage } from '../pages/ServiceDetailPage'
import { TaskDetailPage } from '../pages/TaskDetailPage'

function ProtectedApp() {
  const { session, restoring } = useAuth()
  if (restoring) return <div className="app-boot">正在恢复福安运营会话…</div>
  if (!session) return <Navigate to="/login" replace />

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/members/:memberId" element={<MemberDetailPage />} />
        <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="/plots" element={<PlotsPage />} />
        <Route path="/plots/:plotId" element={<PlotDetailPage />} />
        <Route path="/services" element={<OperationsPage module="services" />} />
        <Route path="/services/:serviceId" element={<ServiceDetailPage />} />
        <Route path="/supply" element={<OperationsPage module="supply" />} />
        <Route path="/config" element={<OperationsPage module="config" />} />
        <Route path="/settings" element={<SystemSettingsPage />} />
        <Route path="/audit" element={<OperationsPage module="audit" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

export function App() {
  const { session } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  )
}
