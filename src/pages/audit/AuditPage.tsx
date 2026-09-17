import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Download,
  FilePenLine,
  Loader2,
  Search,
  Send,
  Settings,
  Trash2,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuditLogDetail, useAuditLogs } from '@/hooks/useAudit'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { AuditLogEntry, AuditLogParams } from '@/types/audit'

const PAGE_SIZE = 20

const actionConfig: Record<string, { icon: LucideIcon; colorClass: string }> = {
  create: { icon: CirclePlus, colorClass: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  update: { icon: FilePenLine, colorClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  delete: { icon: Trash2, colorClass: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
  approve: { icon: CheckCircle, colorClass: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  reject: { icon: XCircle, colorClass: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
  publish: { icon: Send, colorClass: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' },
  cancel: { icon: XCircle, colorClass: 'text-slate-600 bg-slate-50 dark:bg-slate-950/30' },
}

const modelLabels: Record<string, string> = {
  scheduleversion: '排班版本',
  schedule: '排班',
  leaverequest: '請假申請',
  employee: '員工',
  certification: '證照',
  shifttemplate: '班別',
  orgleavesettings: '請假設定',
}

function getModelLabel(modelName: string) {
  const normalized = modelName.split('.').pop()?.replace(/_/g, '').toLowerCase() ?? ''
  return modelLabels[normalized] ?? modelName
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function summarizeChanges(changes: Record<string, unknown> | null) {
  if (!changes || Object.keys(changes).length === 0) return null
  if (typeof changes.reason === 'string') return changes.reason
  const keys = Object.keys(changes)
  return keys.length <= 3 ? `異動欄位：${keys.join('、')}` : `異動 ${keys.length} 個欄位`
}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCurrentPage(entries: AuditLogEntry[]) {
  const header = ['時間', '操作人', '動作', '目標類型', '目標 ID', '變更摘要']
  const rows = entries.map((entry) => [
    formatTimestamp(entry.timestamp),
    entry.user_name,
    entry.action_display,
    getModelLabel(entry.model_name),
    entry.record_id,
    summarizeChanges(entry.changes) ?? '',
  ])
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `操作日誌_${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function AuditPage() {
  const { toast } = useToast()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const params = useMemo<AuditLogParams>(() => ({
    action: action === 'all' ? undefined : action,
    search: search || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    page,
  }), [action, dateFrom, dateTo, page, search])

  const logsQuery = useAuditLogs(params)
  const detailQuery = useAuditLogDetail(selectedId)
  const entries = logsQuery.data?.results ?? []
  const count = logsQuery.data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const exportCsv = () => {
    if (entries.length === 0) return
    downloadCurrentPage(entries)
    toast({ title: '匯出完成', description: `已匯出目前頁面的 ${entries.length} 筆操作日誌` })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">操作日誌</h1>
          <p className="mt-1 text-muted-foreground">由系統自動記錄且不可透過 API 修改的稽核紀錄</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={entries.length === 0 || logsQuery.isLoading}>
          <Download className="mr-2 h-4 w-4" />匯出目前頁面
        </Button>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="mb-6 flex flex-wrap gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="搜尋模型或操作人…"
                className="pl-9"
              />
            </div>
            <Select
              value={action}
              onValueChange={(value) => {
                setAction(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有動作</SelectItem>
                <SelectItem value="create">建立</SelectItem>
                <SelectItem value="update">更新</SelectItem>
                <SelectItem value="delete">刪除</SelectItem>
                <SelectItem value="approve">簽核</SelectItem>
                <SelectItem value="reject">拒絕</SelectItem>
                <SelectItem value="publish">發布</SelectItem>
                <SelectItem value="cancel">取消</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => {
                setDateFrom(event.target.value)
                setPage(1)
              }}
              className="w-40"
              aria-label="開始日期"
            />
            <Input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => {
                setDateTo(event.target.value)
                setPage(1)
              }}
              className="w-40"
              aria-label="結束日期"
            />
          </div>

          {logsQuery.isLoading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />載入操作日誌…
            </div>
          ) : logsQuery.isError ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-destructive">無法載入操作日誌，請稍後重試。</p>
              <Button variant="outline" size="sm" onClick={() => logsQuery.refetch()}>重新載入</Button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
              沒有符合目前條件的操作日誌
            </div>
          ) : (
            <div className="relative">
              <div className="absolute bottom-2 left-[11px] top-2 w-px bg-border" />
              <div className="space-y-4">
                {entries.map((entry) => {
                  const config = actionConfig[entry.action] ?? {
                    icon: Settings,
                    colorClass: 'text-slate-600 bg-slate-50 dark:bg-slate-950/30',
                  }
                  const ActionIcon = config.icon
                  const summary = summarizeChanges(entry.changes)
                  return (
                    <div key={entry.id} className="flex gap-4">
                      <div className={cn('relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full', config.colorClass)}>
                        <ActionIcon className="h-3 w-3" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedId(entry.id)}
                        className="flex-1 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Badge variant="outline" className="shrink-0 text-xs">{entry.action_display}</Badge>
                            <span className="truncate text-sm font-medium">{entry.user_name}</span>
                          </div>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          目標：<span className="text-foreground">{getModelLabel(entry.model_name)} #{entry.record_id}</span>
                        </div>
                        {summary && <div className="mt-1 truncate text-xs text-muted-foreground">{summary}</div>}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!logsQuery.isLoading && !logsQuery.isError && count > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <span className="text-sm text-muted-foreground">共 {count} 筆，第 {page} / {totalPages} 頁</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!logsQuery.data?.previous}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />上一頁
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!logsQuery.data?.next}
                  onClick={() => setPage((current) => current + 1)}
                >
                  下一頁<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>操作日誌明細</DialogTitle>
            <DialogDescription>完整資料僅供查閱，無法從此介面修改。</DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />載入明細…
            </div>
          ) : detailQuery.isError || !detailQuery.data ? (
            <div className="py-8 text-center text-sm text-destructive">無法載入這筆操作明細。</div>
          ) : (
            <div className="space-y-5 text-sm">
              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                <DetailItem label="操作人" value={detailQuery.data.user_name} />
                <DetailItem label="時間" value={formatTimestamp(detailQuery.data.timestamp)} />
                <DetailItem label="動作" value={detailQuery.data.action_display} />
                <DetailItem label="目標" value={`${getModelLabel(detailQuery.data.model_name)} #${detailQuery.data.record_id}`} />
                <DetailItem label="IP 位址" value={detailQuery.data.ip_address || '未記錄'} />
                <DetailItem label="瀏覽器資訊" value={detailQuery.data.user_agent || '未記錄'} />
              </div>
              <JsonBlock title="變更摘要" value={detailQuery.data.changes} />
              <JsonBlock title="異動前" value={detailQuery.data.old_data} />
              <JsonBlock title="異動後" value={detailQuery.data.new_data} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-medium">{value}</div>
    </div>
  )
}

function JsonBlock({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  return (
    <section>
      <h3 className="mb-2 font-medium">{title}</h3>
      <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
        {value ? JSON.stringify(value, null, 2) : '無資料'}
      </pre>
    </section>
  )
}
