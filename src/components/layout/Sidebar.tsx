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
  HelpCircle,
  Sparkles,
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
        description: '排班表建立與管理',
      },
      {
        name: '員工管理',
        href: '/employees',
        icon: Users,
        color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300',
        description: '員工資料與證照管理',
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
        description: '加班記錄與費用試算',
      },
      {
        name: '合規檢查',
        href: '/compliance',
        icon: ShieldCheck,
        color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300',
        description: '勞基法合規驗證',
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
      {
        name: '幫助中心',
        href: '/help',
        icon: HelpCircle,
        color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
        description: '使用指南與常見問題',
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
        <div className="flex-1 overflow-auto py-4 px-3">
          <div className="space-y-1">
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

        <div className="border-t px-3 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">AI 排班系統</div>
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-primary" />
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
    <div className="px-3 pb-3 border-b">
      <h2 className="mb-2 text-lg font-semibold tracking-tight">{title}</h2>
      <nav className="grid items-start text-sm font-medium gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex w-full items-center text-left gap-3 rounded-lg px-3 py-2.5 transition-all group relative',
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <span
              className={cn(
                'rounded-full p-2 flex items-center justify-center transition-all duration-200',
                item.color,
                pathname === item.href ? 'shadow-inner' : 'group-hover:shadow'
              )}
            >
              <item.icon className="h-5 w-5" />
            </span>
            <div className="flex flex-col">
              <span>{item.name}</span>
              {(pathname === item.href || pathname.startsWith(item.href + '/')) && (
                <span className="text-xs text-muted-foreground font-normal">{item.description}</span>
              )}
            </div>
            {(pathname === item.href || pathname.startsWith(item.href + '/')) && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary rounded-full" />
            )}
          </Link>
        ))}
      </nav>
    </div>
  )
}
