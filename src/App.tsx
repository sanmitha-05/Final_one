import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ComplaintRegistrationPage from './pages/complaints/ComplaintRegistrationPage'
import ComplaintReportPage from './pages/complaints/ComplaintReportPage'
import CCEResolutionPage from './pages/complaints/CCEResolutionPage'
import FIDashboardPage from './pages/fi/FIDashboardPage'
import FIResolutionPage from './pages/fi/FIResolutionPage'
import KnowledgeBasePage from './pages/knowledge/KnowledgeBasePage'
import AnalyticsPage from './pages/analytics/AnalyticsPage'
import AdminPage from './pages/admin/AdminPage'
import VehicleRegistryPage from './pages/vehicles/VehicleRegistryPage'
import LoadingSpinner from './components/ui/LoadingSpinner'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen"><LoadingSpinner size="lg" /></div>
  if (!user || !profile) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireRole({ roles, children }: { roles: string[], children: React.ReactNode }) {
  const { profile } = useAuth()
  if (!profile) return <Navigate to="/login" replace />
  if (!roles.includes(profile.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function RootRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen"><LoadingSpinner size="lg" /></div>
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role === 'field_intelligence') return <Navigate to="/fi/dashboard" replace />
  if (profile.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/complaints" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<RootRedirect />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="complaints" element={<ComplaintReportPage />} />
          <Route path="complaints/new" element={
            <RequireRole roles={['cce','admin']}><ComplaintRegistrationPage /></RequireRole>
          } />
          <Route path="complaints/:id/resolve" element={
            <RequireRole roles={['cce','admin']}><CCEResolutionPage /></RequireRole>
          } />
          <Route path="fi/dashboard" element={
            <RequireRole roles={['field_intelligence','admin']}><FIDashboardPage /></RequireRole>
          } />
          <Route path="fi/complaints/:id/investigate" element={
            <RequireRole roles={['field_intelligence','admin']}><FIResolutionPage /></RequireRole>
          } />
          <Route path="vehicles" element={<VehicleRegistryPage />} />
          <Route path="knowledge" element={<KnowledgeBasePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="admin" element={
            <RequireRole roles={['admin']}><AdminPage /></RequireRole>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
