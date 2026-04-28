import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, CalendarCheck, Clock, AlertTriangle, DollarSign, ShieldCheck,
  Sparkles, Wand2, Brain, ChevronRight, LogIn, MessageCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useEmployees } from '@/hooks/useEmployees'
import { cn } from '@/lib/utils'

const weekdays = ['一', '二', '三', '四', '五', '六', '日']

// Shift color map (mirrors design)
const shiftColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  sky:    { bg: 'bg-sky-50',    border: 'border-sky-200',    text: 'text-sky-700',    dot: 'bg-sky-500' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
}

// Mock heatmap data (matches what schedules would look like)
const mockEmployees = ['王小明', '李大華', '陳志明', '林美玲', '張俊宏', '黃雅婷']
const mockShiftGrid = [
  ['sky', 'amber', null, 'violet', 'sky', 'amber', null],
  ['amber', 'sky', 'violet', null, 'amber', 'sky', 'violet'],
  ['violet', null, 'sky', 'amber', 'violet', null, 'sky'],
  [null, 'sky', 'amber', null, 'sky', 'amber', null],
  [null, null, 'amber', 'violet', null, null, 'sky'],
  ['amber', 'violet', null, 'sky', 'amber', null, 'violet'],
] as (string | null)[][]

const shiftNameMap: Record<string, string> = { sky: '早', amber: '午', violet: '晚', indigo: '夜' }
const violationDays: [number, number][] = [[3, 4], [1, 2]] // [empIdx, dayIdx]

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: employeesData } = useEmployees({ is_active: true })

  const employeeCount = employeesData?.count ?? 0
  const displayName = user?.first_name ? `${user.last_name ?? ''}${user.first_name}` : ''

  const stats = [
    {
      title: '在職員工',   value: employeeCount || 7,  delta: '+2',    icon: Users,         color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300',      desc: '本週到職 2 位',
    },
    {
      title: '本週班次',   value: 42,                  delta: '已簽核', icon: CalendarCheck, color: 'text-green-600 bg-green-100 dark:bg-green-900/40 dark:text-green-300',   desc: '法規版 2026/W17',
    },
    {
      title: '今日已打卡', value: '6/7',               delta: '86%',   icon: Clock,         color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-300', desc: '1 人未打卡',
    },
    {
      title: '本週違規',   value: 4,                   delta: '待處理', icon: AlertTriangle, color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/40 dark:text-rose-300',        desc: '2 嚴重 · 1 中度 · 1 輕度',
    },
    {
      title: '本月加班費', value: 'NT$ 23,480',        delta: '+12%',  icon: DollarSign,    color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300',    desc: '預估值',
    },
    {
      title: '合規狀態',   value: '92%',               delta: '良好',  icon: ShieldCheck,   color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300', desc: '較上週 +4pp',
    },
  ]

  const todos = [
    { icon: AlertTriangle, color: 'text-destructive', title: '4 筆排班違規',   desc: '林美玲本週超時 · 李大華休息不足', route: '/compliance' },
    { icon: CalendarCheck, color: 'text-amber-600',   title: '2026/W18 待簽核', desc: 'AI 已產生草稿，待您確認',          route: '/schedules' },
    { icon: LogIn,         color: 'text-rose-600',    title: '今日 1 人未打卡', desc: '林美玲 · 早班 07:00',              route: '/attendance' },
    { icon: MessageCircle, color: 'text-indigo-600',  title: '3 筆調班申請',    desc: '王小明等人申請換班',               route: '/schedules' },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-indigo-100/40 dark:to-indigo-900/20 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium mb-2">
              <Sparkles className="h-3 w-3" /> AI 已為本週生成 2 份排班草稿
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {displayName ? `早安，${displayName}` : '歡迎回來'}
            </h1>
            <p className="text-muted-foreground mt-1">
              2026-04-20（週一）· 台北中山店 · 本週有 4 筆違規待您處理
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate('/ai')}>
              <Brain className="h-4 w-4 mr-2" />AI 法規助手
            </Button>
            <Button onClick={() => navigate('/schedules')}>
              <Wand2 className="h-4 w-4 mr-2" />AI 自動排班
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.title} className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{s.title}</span>
                <span className={cn('rounded-full p-1.5', s.color)}>
                  <s.icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{s.value}</span>
                <Badge variant="outline" className="text-[10px]">{s.delta}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Heatmap + Todo */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Weekly Schedule Heatmap */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle>本週排班熱力圖</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/schedules')}>
              查看完整排班 <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid text-xs overflow-x-auto" style={{ gridTemplateColumns: 'auto repeat(7, 1fr)', gap: '4px' }}>
              <div />
              {weekdays.map((w) => (
                <div key={w} className="text-center text-muted-foreground pb-1 font-medium">週{w}</div>
              ))}
              {mockEmployees.map((name, ei) => (
                <React.Fragment key={ei}>
                  <div className="text-right pr-2 py-1.5 text-muted-foreground truncate max-w-[4rem]">{name}</div>
                  {mockShiftGrid[ei].map((color, di) => {
                    const hasViolation = violationDays.some(([e, d]) => e === ei && d === di)
                    if (!color) return <div key={di} className="h-7 rounded bg-muted/40" />
                    const c = shiftColors[color]
                    return (
                      <div
                        key={di}
                        className={cn(
                          'h-7 rounded border flex items-center justify-center gap-0.5 font-medium',
                          c.bg, c.border, c.text
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
                        {shiftNameMap[color]}
                        {hasViolation && <AlertTriangle className="h-2.5 w-2.5 text-destructive ml-0.5" />}
                      </div>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {Object.entries(shiftColors).map(([key, c]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full', c.dot)} />
                  {key === 'sky' ? '早班 07:00-15:00' : key === 'amber' ? '午班 11:00-19:00' : key === 'violet' ? '晚班 15:00-23:00' : '大夜 23:00-07:00'}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Todo Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>待辦事項</CardTitle>
            <p className="text-xs text-muted-foreground">需要您的注意</p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {todos.map((t, i) => (
              <button
                key={i}
                onClick={() => navigate(t.route)}
                className="w-full flex items-start gap-3 rounded-lg border p-3 text-left hover:bg-muted/40 transition-colors"
              >
                <t.icon className={cn('h-4 w-4 mt-0.5 shrink-0', t.color)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.desc}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
