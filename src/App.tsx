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
  // 重要：在 App 根層先啟動認證初始化，避免 ProtectedRoute loading 死鎖
  useAuth()

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/*"
              element={
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
                      <Route path="/schedules" element={<PlaceholderPage title="排班管理" description="排班表建立、查詢與管理" weekLabel="第 3 週" />} />
                      <Route path="/attendance" element={<PlaceholderPage title="出勤管理" description="打卡紀錄與異常標記" weekLabel="第 5 週" />} />
                      <Route path="/overtime" element={<PlaceholderPage title="加班管理" description="加班紀錄與費用試算" weekLabel="第 9 週" />} />
                      <Route path="/compliance" element={<PlaceholderPage title="合規檢查" description="勞基法合規驗證" weekLabel="第 7 週" />} />
                      <Route path="/help" element={<PlaceholderPage title="幫助中心" description="使用指南與常見問題" />} />

                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="*" element={<PlaceholderPage title="404 頁面不存在" description="您要找的頁面不存在" />} />
                    </Routes>
                  </MainLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
