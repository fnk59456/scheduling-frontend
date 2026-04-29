import { Download, CheckCircle, MessageCircle, Sparkles, Clock, Pencil, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface AuditEntry {
  id: number
  who: string
  action: string
  target: string
  when: string
  type: 'approve' | 'request' | 'ai' | 'attendance' | 'edit' | 'system'
}

const mockAudit: AuditEntry[] = [
  { id: 1, who: '張俊宏（督導）',   action: '簽核排班版本', target: '2026/W17 法規版',          when: '2026-04-20 09:15', type: 'approve' },
  { id: 2, who: '王小明（護理師）', action: '申請調班',     target: '4/22 晚班 → 陳志明',       when: '2026-04-20 08:42', type: 'request' },
  { id: 3, who: 'AI 排班引擎',      action: '產生排班草稿', target: '2026/W17（建議）',          when: '2026-04-19 22:01', type: 'ai' },
  { id: 4, who: '李大華（照服員）', action: '上班打卡',     target: '4/20 午班 · 遲到 14 分',    when: '2026-04-20 11:14', type: 'attendance' },
  { id: 5, who: '張俊宏（督導）',   action: '新增時段',     target: '林美玲 週五 14:00-18:00 不可排', when: '2026-04-19 16:33', type: 'edit' },
  { id: 6, who: '系統排程',         action: '自動比對打卡', target: '4/20 異常 3 筆',            when: '2026-04-20 23:58', type: 'system' },
]

const typeConfig: Record<AuditEntry['type'], { label: string; icon: React.ElementType; colorClass: string }> = {
  approve:    { label: '簽核',   icon: CheckCircle,    colorClass: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  request:    { label: '申請',   icon: MessageCircle,  colorClass: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  ai:         { label: 'AI',     icon: Sparkles,       colorClass: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' },
  attendance: { label: '打卡',   icon: Clock,          colorClass: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30' },
  edit:       { label: '異動',   icon: Pencil,         colorClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  system:     { label: '系統',   icon: Settings,       colorClass: 'text-slate-600 bg-slate-50 dark:bg-slate-950/30' },
}

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">操作日誌</h1>
          <p className="text-muted-foreground mt-1">所有使用者與系統操作皆有不可竄改之稽核紀錄</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />匯出日誌
        </Button>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-2 mb-6">
            <Input placeholder="搜尋 關鍵字、使用者、目標…" className="max-w-sm" />
            <Select defaultValue="all">
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有類型</SelectItem>
                <SelectItem value="approve">簽核</SelectItem>
                <SelectItem value="ai">AI</SelectItem>
                <SelectItem value="system">系統</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="w-36" />
            <Input type="date" className="w-36" />
          </div>

          <div className="relative">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-4">
              {mockAudit.map((a) => {
                const cfg = typeConfig[a.type]
                const TypeIcon = cfg.icon
                return (
                  <div key={a.id} className="flex gap-4">
                    <div className={cn('relative h-6 w-6 rounded-full flex items-center justify-center shrink-0', cfg.colorClass)}>
                      <TypeIcon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 rounded-lg border p-3 bg-background">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="shrink-0 text-xs">{cfg.label}</Badge>
                          <span className="font-medium text-sm truncate">{a.who}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground text-sm truncate">{a.action}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono shrink-0">{a.when}</span>
                      </div>
                      <div className="text-sm mt-1 text-muted-foreground">
                        目標：<span className="text-foreground">{a.target}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
