import { useState } from 'react'
import { RefreshCw, ShieldCheck, AlertTriangle, AlertCircle, Info, Sparkles, Brain } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type Severity = 'high' | 'medium' | 'low'

interface Violation {
  id: number
  severity: Severity
  employee: string
  date: string
  type: string
  message: string
  law: string
  suggestion: string
}

const mockViolations: Violation[] = [
  {
    id: 1, severity: 'high', employee: '林美玲', date: '2026-04-24',
    type: '超時工時',
    message: '本週累計 48.5 小時 · 超過法定 40 小時上限',
    law: '勞基法 §32-I',
    suggestion: '將週五午班改派給陳志明（本週 34 小時，仍有餘額）',
  },
  {
    id: 2, severity: 'high', employee: '李大華', date: '2026-04-22',
    type: '休息不足',
    message: '晚班結束至隔日早班僅 8 小時，低於 11 小時最低間隔',
    law: '勞基法 §34',
    suggestion: '將隔日早班延後至 10:00 或改派他人',
  },
  {
    id: 3, severity: 'medium', employee: '吳宗翰', date: '2026-04-23',
    type: '連續出勤',
    message: '已連續工作 7 天，建議強制休息',
    law: '勞基法 §36',
    suggestion: '於本週安排 1 天例假',
  },
  {
    id: 4, severity: 'low', employee: '陳志明', date: '2026-04-25',
    type: '夜班未輪替',
    message: '連續 4 週排大夜班，建議輪替',
    law: '職安署建議',
    suggestion: '下週改排午班，由張俊宏頂替大夜',
  },
]

const severityConfig: Record<Severity, { label: string; icon: React.ElementType; badgeClass: string; iconClass: string; bgClass: string }> = {
  high:   { label: '嚴重', icon: AlertTriangle, badgeClass: 'bg-destructive/10 text-destructive border-destructive/20', iconClass: 'bg-destructive/10 text-destructive', bgClass: 'border-l-4 border-l-destructive' },
  medium: { label: '中度', icon: AlertCircle,  badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',               iconClass: 'bg-amber-50 text-amber-600',          bgClass: '' },
  low:    { label: '輕度', icon: Info,          badgeClass: 'bg-muted text-muted-foreground border-border',              iconClass: 'bg-muted text-muted-foreground',       bgClass: '' },
}

export default function CompliancePage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | Severity>('all')

  const filtered = filter === 'all' ? mockViolations : mockViolations.filter((v) => v.severity === filter)
  const highCount = mockViolations.filter((v) => v.severity === 'high').length
  const medCount = mockViolations.filter((v) => v.severity === 'medium').length
  const lowCount = mockViolations.filter((v) => v.severity === 'low').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">合規檢查</h1>
          <p className="text-muted-foreground mt-1">即時掃描本週排班，依勞基法條文分級標示違規</p>
        </div>
        <Button onClick={() => toast({ title: '重新掃描完成', description: `共發現 ${mockViolations.length} 筆違規` })}>
          <RefreshCw className="h-4 w-4 mr-2" />重新掃描
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { t: '整體合規率', v: '92%',  d: '較上週 +4pp',   c: 'text-emerald-600', icon: ShieldCheck, bg: 'bg-emerald-100' },
          { t: '嚴重違規',  v: highCount, d: '需立即處理',   c: 'text-destructive', icon: AlertTriangle, bg: 'bg-red-100' },
          { t: '中度違規',  v: medCount,  d: '建議本週改善', c: 'text-amber-600',   icon: AlertCircle,   bg: 'bg-amber-100' },
          { t: '輕度違規',  v: lowCount,  d: '可待下期調整', c: 'text-muted-foreground', icon: Info, bg: 'bg-muted' },
        ].map((s) => (
          <Card key={s.t}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{s.t}</span>
                <span className={cn('rounded-full p-1.5', s.bg, s.c)}><s.icon className="h-4 w-4" /></span>
              </div>
              <div className={cn('text-2xl font-bold mt-2', s.c)}>{s.v}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.d}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">全部 {mockViolations.length}</TabsTrigger>
            <TabsTrigger value="high">嚴重</TabsTrigger>
            <TabsTrigger value="medium">中度</TabsTrigger>
            <TabsTrigger value="low">輕度</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => navigate('/ai')}>
          <Brain className="h-4 w-4 mr-2" />詢問法規助手
        </Button>
      </div>

      <div className="space-y-3">
        {filtered.map((v) => {
          const cfg = severityConfig[v.severity]
          const SevIcon = cfg.icon
          return (
            <Card key={v.id} className={cn('card-hover', cfg.bgClass)}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', cfg.iconClass)}>
                    <SevIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{v.type}</span>
                      <Badge variant="outline" className={cfg.badgeClass}>{cfg.label}</Badge>
                      <Badge variant="outline" className="font-mono text-xs">{v.law}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">{v.date}</span>
                    </div>
                    <div className="text-sm mt-2">
                      <span className="font-medium">{v.employee}</span>
                      <span className="text-muted-foreground"> · {v.message}</span>
                    </div>
                    <div className="mt-3 rounded-lg bg-indigo-50/60 border border-indigo-200/60 p-3 flex items-start gap-2 dark:bg-indigo-950/30 dark:border-indigo-800/40">
                      <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="flex-1 text-sm">
                        <div className="text-xs font-medium text-indigo-700 dark:text-indigo-400">AI 建議</div>
                        <div className="text-indigo-900/90 dark:text-indigo-300 mt-0.5">{v.suggestion}</div>
                      </div>
                      <Button size="sm" variant="outline">套用</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
