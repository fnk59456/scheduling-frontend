import { Outlet, Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Award, Building2, CalendarDays, ShieldCheck, ListOrdered, CalendarOff } from 'lucide-react'

const settingsTabs = [
  { name: '班別模板',     href: '/settings/shifts',        icon: CalendarDays },
  { name: '員工優先順序', href: '/settings/priorities',    icon: ListOrdered },
  { name: '排班規則',     href: '/settings/rules',         icon: ShieldCheck },
  { name: '機構與分店',   href: '/settings/organizations', icon: Building2 },
  { name: '證照設定',     href: '/settings/certifications', icon: Award },
  { name: '請假設定',     href: '/settings/leaves',        icon: CalendarOff },
]

export default function SettingsPage() {
  const location = useLocation()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">系統設定</h1>
        <p className="text-muted-foreground mt-1">班別模板、排班規則、證照、請假額度與機構資料</p>
      </div>

      <div className="flex w-fit flex-wrap items-center gap-1 rounded-xl border bg-muted/40 p-1">
        {settingsTabs.map((tab) => {
          const active = location.pathname === tab.href || location.pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="h-4 w-4" />{tab.name}
            </Link>
          )
        })}
      </div>

      <Outlet />
    </div>
  )
}
