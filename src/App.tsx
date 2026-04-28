import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { MainLayout } from '@/components/layout/MainLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import EmployeesPage from '@/pages/employees/EmployeesPage'
import EmployeeDetailPage from '@/pages/employees/EmployeeDetailPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import OrganizationsPage from '@/pages/settings/OrganizationsPage'
import ShiftTemplatesPage from '@/pages/settings/ShiftTemplatesPage'
import ShiftRulesPage from '@/pages/settings/ShiftRulesPage'
import CertificationsPage from '@/pages/settings/CertificationsPage'
import EmployeePrioritiesPage from '@/pages/settings/EmployeePrioritiesPage'
import SchedulesPage from '@/pages/schedules/SchedulesPage'
import AttendancePage from '@/pages/attendance/AttendancePage'
import OvertimePage from '@/pages/overtime/OvertimePage'
import CompliancePage from '@/pages/compliance/CompliancePage'
import AIAssistantPage from '@/pages/ai/AIAssistantPage'
import AuditPage from '@/pages/audit/AuditPage'
import PlaceholderPage from '@/pages/PlaceholderPage'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

function App() {
  // 暫時開關：Firebase 部署時可跳過登入介面（避免綁定本地 docker API）
  // 使用方式：在 .env.production 或 Firebase Hosting env 對應 build 設定 VITE_BYPASS_AUTH=true
  const BYPASS_AUTH = String(import.meta.env.VITE_BYPASS_AUTH || '').toLowerCase() === 'true'

  // 重要：在 App 根層先啟動認證初始化，避免 ProtectedRoute loading 死鎖
  // 若開啟 BYPASS_AUTH，則不啟動 useAuth（避免一直打 /auth/users/me 或 token 相關請求）
  if (!BYPASS_AUTH) {
    useAuth()
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Router>
          <Routes>
            <Route path="/login" element={BYPASS_AUTH ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

            <Route
              path="/*"
              element={
                BYPASS_AUTH ? (
                  <MainLayout>
                    <Routes>
                      <Route path="/dashboard" element={<DashboardPage />} />

                      {/* 員工管理 */}
                      <Route path="/employees" element={<EmployeesPage />} />
                      <Route path="/employees/:id" element={<EmployeeDetailPage />} />

                      {/* 系統設定（Tabs 布局） */}
                      <Route path="/settings" element={<SettingsPage />}>
                        <Route index element={<Navigate to="/settings/shifts" replace />} />
                        <Route path="shifts" element={<ShiftTemplatesPage />} />
                        <Route path="priorities" element={<EmployeePrioritiesPage />} />
                        <Route path="rules" element={<ShiftRulesPage />} />
                        <Route path="organizations" element={<OrganizationsPage />} />
                        <Route path="certifications" element={<CertificationsPage />} />
                      </Route>

                      {/* 後續週次功能佔位 */}
                      <Route path="/schedules" element={<SchedulesPage />} />
                      <Route path="/attendance" element={<AttendancePage />} />
                      <Route path="/overtime" element={<OvertimePage />} />
                      <Route path="/compliance" element={<CompliancePage />} />
                      <Route path="/ai" element={<AIAssistantPage />} />
                      <Route path="/audit" element={<AuditPage />} />
                      <Route path="/help" element={<PlaceholderPage title="幫助中心" description="使用指南與常見問題" />} />

                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="*" element={<PlaceholderPage title="404 頁面不存在" description="您要找的頁面不存在" />} />
                    </Routes>
                  </MainLayout>
                ) : (
                  <ProtectedRoute>
                    <MainLayout>
                      <Routes>
                        <Route path="/dashboard" element={<DashboardPage />} />

                        {/* 員工管理 */}
                        <Route path="/employees" element={<EmployeesPage />} />
                        <Route path="/employees/:id" element={<EmployeeDetailPage />} />

                        {/* 系統設定（Tabs 布局） */}
                        <Route path="/settings" element={<SettingsPage />}>
                          <Route index element={<Navigate to="/settings/organizations" replace />} />
                          <Route path="organizations" element={<OrganizationsPage />} />
                          <Route path="shifts" element={<ShiftTemplatesPage />} />
                          <Route path="rules" element={<ShiftRulesPage />} />
                          <Route path="certifications" element={<CertificationsPage />} />
                        </Route>

                        {/* 後續週次功能佔位 */}
                        <Route path="/schedules" element={<SchedulesPage />} />
                        <Route path="/attendance" element={<AttendancePage />} />
                        <Route path="/overtime" element={<OvertimePage />} />
                        <Route path="/compliance" element={<CompliancePage />} />
                        <Route path="/ai" element={<AIAssistantPage />} />
                        <Route path="/audit" element={<AuditPage />} />
                        <Route path="/help" element={<PlaceholderPage title="幫助中心" description="使用指南與常見問題" />} />

                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="*" element={<PlaceholderPage title="404 頁面不存在" description="您要找的頁面不存在" />} />
                      </Routes>
                    </MainLayout>
                  </ProtectedRoute>
                )
              }
            />
          </Routes>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
