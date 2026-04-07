import { Users, CalendarDays, Clock, ShieldCheck, Building2, Award } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useEmployees } from '@/hooks/useEmployees'
import { useOrganizations, useBranches } from '@/hooks/useOrganizations'
import { useShiftTemplates } from '@/hooks/useShifts'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: employeesData } = useEmployees({ is_active: true })
  const { data: orgsData } = useOrganizations()
  const { data: branchesData } = useBranches()
  const { data: shiftsData } = useShiftTemplates({ is_active: true })

  const stats = [
    { title: '在職員工', value: employeesData?.count ?? '--', icon: Users, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300', description: '目前在職人數' },
    { title: '班別模板', value: shiftsData?.count ?? '--', icon: CalendarDays, color: 'text-green-600 bg-green-100 dark:bg-green-900/40 dark:text-green-300', description: '已啟用的班別' },
    { title: '機構數', value: orgsData?.count ?? '--', icon: Building2, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300', description: '管理中的機構' },
    { title: '分店數', value: branchesData?.count ?? '--', icon: Award, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-300', description: '所有分店' },
    { title: '今日出勤', value: '--', icon: Clock, color: 'text-teal-600 bg-teal-100 dark:bg-teal-900/40 dark:text-teal-300', description: '已打卡人數（第 5 週上線）' },
    { title: '合規狀態', value: '正常', icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300', description: '本週無違規' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          歡迎回來{user?.first_name ? `，${user.first_name}` : ''}
        </h1>
        <p className="text-muted-foreground mt-1">以下是您的排班系統營運總覽</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((card) => (
          <Card key={card.title} className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <span className={`rounded-full p-2 ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>近期排班</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              排班功能將在第 3 週上線
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>系統通知</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              目前沒有新通知
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
