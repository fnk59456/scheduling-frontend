import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Clock,
  Timer,
  ShieldCheck,
  Settings,
  Sparkles,
  Brain,
  FileText,
} from 'lucide-react'
import type { RoleName } from '@/types/auth'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  color: string
  description: string
  roles?: RoleName[]
}

const navigationSections: { title: string; items: NavItem[] }[] = [
  {
    title: '主要功能',
    items: [
      {
        name: '營運總覽',
        href: '/dashboard',
        icon: LayoutDashboard,
        color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
        description: '系統概況與即時數據',
      },
      {
        name: '排班管理',
        href: '/schedules',
        icon: CalendarDays,
        color: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300',
        description: '排班表與版本管理',
      },
      {
        name: '員工管理',
        href: '/employees',
        icon: Users,
        color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300',
        description: '員工資料與可用性設定',
      },
      {
        name: '出勤管理',
        href: '/attendance',
        icon: Clock,
        color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300',
        description: '打卡紀錄與異常標記',
      },
    ],
  },
  {
    title: '管理功能',
    items: [
      {
        name: '加班管理',
        href: '/overtime',
        icon: Timer,
        color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
        description: '加班時數與費用試算',
      },
      {
        name: '合規檢查',
        href: '/compliance',
        icon: ShieldCheck,
        color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300',
        description: '勞基法合規驗證',
      },
      {
        name: 'AI 法規助手',
        href: '/ai',
        icon: Brain,
        color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
        description: '勞基法智慧問答',
      },
      {
        name: '操作日誌',
        href: '/audit',
        icon: FileText,
        color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        description: '稽核與操作歷史',
      },
    ],
  },
  {
    title: '系統',
    items: [
      {
        name: '系統設定',
        href: '/settings',
        icon: Settings,
        color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
        description: '班別、規則與組織設定',
        roles: ['admin', 'manager'],
      },
    ],
  },
]

export function Sidebar() {
  const location = useLocation()
  const pathname = location.pathname
  const hasRole = useAuthStore((s) => s.hasRole)

  return (
    <div className="hidden border-r bg-background/80 backdrop-blur-sm md:block w-64 shadow-sm h-full">
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto py-3 px-3">
          <div className="space-y-0.5">
            {navigationSections.map((section) => (
              <SidebarSection
                key={section.title}
                title={section.title}
                items={section.items.filter((item) => !item.roles || hasRole(item.roles))}
                pathname={pathname}
              />
            ))}
          </div>
        </div>

        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">AI 排班系統</span>
            <div className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-primary">v1.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarSection({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  if (items.length === 0) return null

  return (
    <div className="px-1 pb-3 border-b last:border-b-0">
      <h2 className="mb-2 text-xs font-semibold tracking-tight px-2 pt-2 text-muted-foreground uppercase">{title}</h2>
      <nav className="grid gap-0.5 text-sm">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex w-full items-center text-left gap-3 rounded-lg px-2.5 py-2 transition-all group relative',
                active
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span
                className={cn(
                  'rounded-full p-1.5 flex items-center justify-center transition-all shrink-0',
                  item.color
                )}
              >
                <item.icon className="h-4 w-4" />
              </span>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="truncate">{item.name}</span>
                {active && (
                  <span className="text-[10px] text-muted-foreground font-normal truncate">{item.description}</span>
                )}
              </div>
              {active && (
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-full" />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
