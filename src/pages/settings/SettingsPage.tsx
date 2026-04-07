import { Outlet, Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Building2, Clock, ShieldCheck, Award } from 'lucide-react'

const settingsTabs = [
  { name: '組織與分店', href: '/settings/organizations', icon: Building2 },
  { name: '班別設定', href: '/settings/shifts', icon: Clock },
  { name: '排班規則', href: '/settings/rules', icon: ShieldCheck },
  { name: '證照管理', href: '/settings/certifications', icon: Award },
]

export default function SettingsPage() {
  const location = useLocation()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">系統設定</h1>
        <p className="text-muted-foreground mt-1">管理組織、班別、規則與證照設定</p>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {settingsTabs.map((tab) => (
          <Link
            key={tab.href}
            to={tab.href}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              location.pathname === tab.href
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
            )}
          >
            <tab.icon className="h-4 w-4" />{tab.name}
          </Link>
        ))}
      </div>

      <Outlet />
    </div>
  )
}
