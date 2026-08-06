import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useQueries } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock3, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { schedulesApi } from '@/api/endpoints/schedules'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { buildCrossVersionWarningMap } from '@/lib/scheduleOverlap'
import type { EmployeeListItem } from '@/types/employee'
import type { ComplianceViolation, Schedule, ScheduleVersion } from '@/types/schedule'
import type { ShiftTemplate } from '@/types/shift'

type DialogOrigin = {
  x: number
  y: number
}

type ScheduleDisplayMode = 'current' | 'stitched'

type EmployeeMonthScheduleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeListItem
  versionId: number
  versionLabel: string
  initialMonth: Date
  origin: DialogOrigin
  templates: ShiftTemplate[]
  violations: ComplianceViolation[]
  versions: ScheduleVersion[]
}

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六']

const shiftChipColors = [
  'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
  'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
  'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300',
  'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
  'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
]

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function startOfWeek(date: Date) {
  const copy = new Date(date)
  const weekday = copy.getDay()
  copy.setDate(copy.getDate() - weekday)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function employeeName(employee: EmployeeListItem) {
  return employee.user_name
    || `${employee.user.first_name} ${employee.user.last_name}`.trim()
    || employee.user.username
}

function sanitizeFilename(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').trim()
}

export function EmployeeMonthScheduleDialog({
  open,
  onOpenChange,
  employee,
  versionId,
  versionLabel,
  initialMonth,
  origin,
  templates,
  violations,
  versions,
}: EmployeeMonthScheduleDialogProps) {
  const [month, setMonth] = useState(() => startOfMonth(initialMonth))
  const [displayMode, setDisplayMode] = useState<ScheduleDisplayMode>('current')
  const [exportLoading, setExportLoading] = useState(false)
  const [showExportRange, setShowExportRange] = useState(false)
  const [exportDateFrom, setExportDateFrom] = useState(() => formatDate(startOfMonth(initialMonth)))
  const [exportDateTo, setExportDateTo] = useState(() => formatDate(endOfMonth(initialMonth)))

  useEffect(() => {
    if (open) {
      setMonth(startOfMonth(initialMonth))
      setDisplayMode('current')
      setShowExportRange(false)
      setExportDateFrom(formatDate(startOfMonth(initialMonth)))
      setExportDateTo(formatDate(endOfMonth(initialMonth)))
    }
  }, [employee.id, initialMonth, open])

  const monthStart = useMemo(() => startOfMonth(month), [month])
  const monthEnd = useMemo(() => endOfMonth(month), [month])
  const calendarDays = useMemo(() => {
    const firstVisibleDay = startOfWeek(monthStart)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstVisibleDay)
      date.setDate(firstVisibleDay.getDate() + index)
      return date
    })
  }, [monthStart])
  const calendarStart = calendarDays[0]
  const calendarEnd = calendarDays[calendarDays.length - 1]
  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === versionId) ?? null,
    [versionId, versions],
  )
  const timelineVersions = useMemo(
    () => selectedVersion
      ? versions.filter((version) => (
          version.organization === selectedVersion.organization
          && version.version_type === selectedVersion.version_type
          && version.status !== 'archived'
        ))
      : [],
    [selectedVersion, versions],
  )
  const validationVersions = useMemo(
    () => selectedVersion
      ? [selectedVersion, ...timelineVersions.filter((version) => version.id !== selectedVersion.id)]
      : [],
    [selectedVersion, timelineVersions],
  )
  const scheduleQueries = useQueries({
    queries: open
      ? validationVersions.map((version) => ({
          queryKey: [
            'schedules',
            'employee-month-timeline',
            version.id,
            employee.id,
            formatDate(calendarStart),
            formatDate(calendarEnd),
          ],
          queryFn: () => schedulesApi.listAll({
            version: version.id,
            employee: employee.id,
            date_from: formatDate(calendarStart),
            date_to: formatDate(calendarEnd),
          }),
        }))
      : [],
  })
  const rawSchedules = useMemo(
    () => scheduleQueries.flatMap((query) => query.data?.results ?? []),
    [scheduleQueries],
  )
  const currentVersionSchedules = useMemo(
    () => rawSchedules.filter((schedule) => schedule.schedule_version === versionId),
    [rawSchedules, versionId],
  )
  const schedules = useMemo(
    () => displayMode === 'stitched' ? rawSchedules : currentVersionSchedules,
    [currentVersionSchedules, displayMode, rawSchedules],
  )
  const isLoading = displayMode === 'stitched'
    ? scheduleQueries.some((query) => query.isLoading)
    : (scheduleQueries[0]?.isLoading ?? false)
  const isFetching = displayMode === 'stitched'
    ? scheduleQueries.some((query) => query.isFetching)
    : (scheduleQueries[0]?.isFetching ?? false)
  const isError = displayMode === 'stitched'
    ? scheduleQueries.some((query) => query.isError)
    : (scheduleQueries[0]?.isError ?? false)
  const refetch = () => displayMode === 'stitched'
    ? Promise.all(scheduleQueries.map((query) => query.refetch()))
    : scheduleQueries[0]?.refetch()
  const scheduleByDate = useMemo(() => {
    const map = new Map<string, Schedule[]>()
    for (const schedule of schedules) {
      const values = map.get(schedule.schedule_date) ?? []
      values.push(schedule)
      values.sort((a, b) => a.shift_template.start_time.localeCompare(b.shift_template.start_time))
      map.set(schedule.schedule_date, values)
    }
    return map
  }, [schedules])
  const monthSchedules = useMemo(() => {
    const from = formatDate(monthStart)
    const to = formatDate(monthEnd)
    return schedules.filter((schedule) => (
      schedule.schedule_date >= from && schedule.schedule_date <= to
    ))
  }, [monthEnd, monthStart, schedules])

  const templateIndexById = useMemo(
    () => new Map(templates.map((template, index) => [template.id, index])),
    [templates],
  )

  const visibleViolations = useMemo(() => {
    const from = formatDate(calendarStart)
    const to = formatDate(calendarEnd)
    return violations.filter((violation) => (
      violation.employee_pk === employee.id
      && violation.schedule_date >= from
      && violation.schedule_date <= to
    ))
  }, [calendarEnd, calendarStart, employee.id, violations])
  const relevantViolations = useMemo(() => {
    const from = formatDate(monthStart)
    const to = formatDate(monthEnd)
    return visibleViolations.filter((violation) => (
      violation.schedule_date >= from && violation.schedule_date <= to
    ))
  }, [monthEnd, monthStart, visibleViolations])

  const violationByCell = useMemo(() => {
    const map = new Map<string, ComplianceViolation>()
    for (const violation of visibleViolations) {
      const key = `${violation.schedule_date}:${violation.shift_template_id ?? ''}`
      const existing = map.get(key)
      if (!existing || (existing.severity === 'soft' && violation.severity === 'hard')) {
        map.set(key, violation)
      }
    }
    return map
  }, [visibleViolations])
  const crossVersionWarningMap = useMemo(
    () => buildCrossVersionWarningMap(rawSchedules),
    [rawSchedules],
  )
  const visibleOwnerVersions = useMemo(() => {
    const versionIds = new Set(monthSchedules.map((schedule) => schedule.schedule_version))
    return timelineVersions
      .filter((version) => versionIds.has(version.id))
      .sort((left, right) => left.version_label.localeCompare(right.version_label, 'zh-TW'))
  }, [monthSchedules, timelineVersions])
  const conflictDates = useMemo(
    () => [...new Set(monthSchedules
      .filter((schedule) => (crossVersionWarningMap.get(schedule.id)?.length ?? 0) > 0)
      .map((schedule) => schedule.schedule_date))].sort(),
    [crossVersionWarningMap, monthSchedules],
  )

  const totalHours = useMemo(
    () => monthSchedules.reduce((total, schedule) => {
      const hours = Number(schedule.expected_hours || schedule.shift_template.duration_hours || 0)
      return total + (Number.isFinite(hours) ? hours : 0)
    }, 0),
    [monthSchedules],
  )

  const todayKey = formatDate(new Date())
  const monthLabel = new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long' }).format(month)
  const name = employeeName(employee)
  const modeLabel = displayMode === 'stitched' ? '跨版本拼接' : '目前版本'
  const exportRangeDiffersFromPreview = exportDateFrom !== formatDate(monthStart)
    || exportDateTo !== formatDate(monthEnd)

  const openExportRange = () => {
    setExportDateFrom(formatDate(monthStart))
    setExportDateTo(formatDate(monthEnd))
    setShowExportRange(true)
  }

  const downloadPersonalSchedule = async () => {
    if (!selectedVersion || !exportDateFrom || !exportDateTo || exportDateFrom > exportDateTo) {
      toast({
        title: '下載失敗',
        description: '請確認起訖日期正確',
        variant: 'destructive',
      })
      return
    }
    try {
      setExportLoading(true)
      const exportVersions = displayMode === 'stitched' ? timelineVersions : [selectedVersion]
      const scheduleResponses = await Promise.all(
        exportVersions.map((version) => schedulesApi.listAll({
          version: version.id,
          employee: employee.id,
          date_from: exportDateFrom,
          date_to: exportDateTo,
        })),
      )
      const exportSchedules = scheduleResponses.flatMap((response) => response.results)
      const { createScheduleWorkbook } = await import('@/lib/scheduleExcelExport')
      const buffer = await createScheduleWorkbook({
        schedules: exportSchedules,
        employees: [employee],
        dateFrom: exportDateFrom,
        dateTo: exportDateTo,
        versionLabel: `${name}｜${exportDateFrom}～${exportDateTo} 個人班表（${modeLabel}）`,
        layout: 'personal',
      })
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = sanitizeFilename(`${employee.employee_id}_${name}_個人班表_${modeLabel}_${exportDateFrom}_${exportDateTo}.xlsx`)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setShowExportRange(false)
    } catch (error: unknown) {
      toast({
        title: '下載失敗',
        description: error instanceof Error ? error.message : '無法產生個人班表 Excel',
        variant: 'destructive',
      })
    } finally {
      setExportLoading(false)
    }
  }

  const dialogStyle = {
    '--month-dialog-x': `${origin.x}px`,
    '--month-dialog-y': `${origin.y}px`,
  } as CSSProperties

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="month-schedule-dialog max-h-[94vh] w-[calc(100vw-1rem)] max-w-6xl gap-5 overflow-y-auto p-4 sm:w-[calc(100vw-2rem)] sm:p-6"
        overlayClassName="month-schedule-overlay"
        style={dialogStyle}
      >
        <DialogHeader className="pr-8">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
              {name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate">{name}的月班表</DialogTitle>
              <DialogDescription className="mt-1 truncate">
                {employee.employee_id} · {employee.position} · {versionLabel}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />排班天數</div>
            <div className="mt-1 text-xl font-bold">{new Set(monthSchedules.map((schedule) => schedule.schedule_date)).size}<span className="ml-1 text-xs font-normal text-muted-foreground">天</span></div>
          </div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />預計工時</div>
            <div className="mt-1 text-xl font-bold">{Math.round(totalHours * 10) / 10}<span className="ml-1 text-xs font-normal text-muted-foreground">小時</span></div>
          </div>
          <div className={cn(
            'rounded-lg border px-3 py-2.5',
            (displayMode === 'stitched' ? conflictDates.length : relevantViolations.length)
              ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
              : 'bg-muted/30',
          )}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              {displayMode === 'stitched' ? '重疊提醒' : '合規提醒'}
            </div>
            <div className="mt-1 text-xl font-bold">
              {displayMode === 'stitched' ? conflictDates.length : relevantViolations.length}
              <span className="ml-1 text-xs font-normal text-muted-foreground">項</span>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border bg-muted/30 p-1" role="group" aria-label="月班表顯示模式">
            <Button
              type="button"
              size="sm"
              variant={displayMode === 'current' ? 'default' : 'ghost'}
              className="h-8 rounded-md px-4"
              onClick={() => setDisplayMode('current')}
              aria-pressed={displayMode === 'current'}
            >
              目前版本
            </Button>
            <Button
              type="button"
              size="sm"
              variant={displayMode === 'stitched' ? 'default' : 'ghost'}
              className="h-8 rounded-md px-4"
              onClick={() => setDisplayMode('stitched')}
              aria-pressed={displayMode === 'stitched'}
            >
              跨版本拼接
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setMonth((current) => addMonths(current, -1))}
            aria-label="查看上個月"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-36 text-center text-base font-semibold">{monthLabel}</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setMonth((current) => addMonths(current, 1))}
            aria-label="查看下個月"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="sm:ml-2"
            onClick={openExportRange}
            disabled={exportLoading || !selectedVersion}
          >
            {exportLoading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Download className="mr-2 h-4 w-4" />}
            下載 Excel
          </Button>
        </div>

        {showExportRange && (
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="mb-3">
              <div className="text-sm font-medium">個人班表輸出範圍</div>
              <p className="mt-1 text-xs text-muted-foreground">
                目前採用「{modeLabel}」模式；Excel 將使用與月班表相同的班次來源，並只輸出 {name}。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="personal-export-date-from">起始日期</Label>
                <Input
                  id="personal-export-date-from"
                  type="date"
                  value={exportDateFrom}
                  onChange={(event) => setExportDateFrom(event.target.value)}
                  disabled={exportLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="personal-export-date-to">結束日期</Label>
                <Input
                  id="personal-export-date-to"
                  type="date"
                  value={exportDateTo}
                  min={exportDateFrom || undefined}
                  onChange={(event) => setExportDateTo(event.target.value)}
                  disabled={exportLoading}
                />
              </div>
              <div className="flex gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportRange(false)}
                  disabled={exportLoading}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={downloadPersonalSchedule}
                  disabled={exportLoading || !exportDateFrom || !exportDateTo || exportDateFrom > exportDateTo}
                >
                  {exportLoading
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Download className="mr-2 h-4 w-4" />}
                  下載
                </Button>
              </div>
            </div>
            {exportRangeDiffersFromPreview && (
              <p className="mt-3 text-xs text-amber-700">
                下載範圍超出目前預覽月份；資料來源模式相同，但額外月份不會顯示在目前月曆上。
              </p>
            )}
          </div>
        )}

        {displayMode === 'stitched' && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 text-blue-900">
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {visibleOwnerVersions.length > 0
                    ? `本月已拼接 ${visibleOwnerVersions.length} 個含班次版本`
                    : '本月沒有可拼接的班次'}
                </div>
                {visibleOwnerVersions.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    {visibleOwnerVersions.map((version) => (
                      <span key={version.id} className="rounded-full border border-blue-200 bg-background px-2 py-0.5">
                        {version.version_label}
                      </span>
                    ))}
                  </div>
                )}
                {conflictDates.length > 0 && (
                  <p className="mt-1.5 text-xs text-amber-700">
                    重疊日期：{conflictDates.join('、')}；班次會全部保留並標示警告。
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="relative overflow-x-auto rounded-xl border bg-background">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {weekdayLabels.map((label, index) => (
                <div key={label} className={cn('px-2 py-2 text-center text-xs font-semibold', (index === 0 || index === 6) && 'text-primary')}>
                  週{label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((date, index) => {
                const dateKey = formatDate(date)
                const isCurrentMonth = date.getMonth() === month.getMonth()
                const daySchedules = scheduleByDate.get(dateKey) ?? []
                const hasConflict = daySchedules.some((schedule) => (crossVersionWarningMap.get(schedule.id)?.length ?? 0) > 0)

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      'min-h-24 border-b border-r p-1.5 last:border-r-0',
                      (index % 7 === 0 || index % 7 === 6) && isCurrentMonth && 'bg-primary/[0.025]',
                      !isCurrentMonth && 'bg-muted/20 text-muted-foreground/50',
                      hasConflict && 'bg-amber-50/40',
                    )}
                  >
                    <div className="flex items-center justify-between px-0.5">
                      <span className={cn(
                        'flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-medium',
                        dateKey === todayKey && 'bg-primary text-primary-foreground',
                      )}>
                        {date.getDate()}
                      </span>
                      {daySchedules.some((schedule) => violationByCell.has(`${dateKey}:${schedule.shift_template.id}`))
                        && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                    </div>

                    {daySchedules.length ? (
                      <div className={cn('mt-1 space-y-1', !isCurrentMonth && 'opacity-70')}>
                        {daySchedules.map((schedule) => {
                          const templateIndex = templateIndexById.get(schedule.shift_template.id) ?? schedule.shift_template.id
                          const violation = violationByCell.get(`${dateKey}:${schedule.shift_template.id}`)
                          const crossWarnings = crossVersionWarningMap.get(schedule.id) ?? []
                          const scheduleVersion = timelineVersions.find((version) => version.id === schedule.schedule_version)
                          return (
                            <div
                              key={schedule.id}
                              className={cn(
                                'relative rounded-md border px-2 py-1.5',
                                shiftChipColors[templateIndex % shiftChipColors.length],
                                violation?.severity === 'hard' && 'border-destructive ring-1 ring-destructive/40',
                                violation?.severity === 'soft' && 'border-amber-400 ring-1 ring-amber-300/50',
                                crossWarnings.length > 0 && 'border-amber-400 pr-6 ring-1 ring-amber-300/50',
                              )}
                              title={[
                                displayMode === 'stitched'
                                  ? `來源版本：${scheduleVersion?.version_label ?? `#${schedule.schedule_version}`}`
                                  : '',
                                ...crossWarnings.map((other) => {
                                  const otherVersion = timelineVersions.find((version) => version.id === other.schedule_version)
                                  return `跨版本重疊：${otherVersion?.version_label ?? `#${other.schedule_version}`} · ${other.shift_template.name} ${other.shift_template.start_time.slice(0, 5)}-${other.shift_template.end_time.slice(0, 5)}`
                                }),
                                violation ? `${violation.rule_label}：${JSON.stringify(violation.detail)}` : '',
                              ].filter(Boolean).join('\n') || undefined}
                            >
                              <div className="truncate text-xs font-semibold">{schedule.shift_template.name}</div>
                              <div className="mt-0.5 whitespace-nowrap font-mono text-[10px] opacity-75">
                                {schedule.shift_template.start_time.slice(0, 5)}-{schedule.shift_template.end_time.slice(0, 5)}
                              </div>
                              {displayMode === 'stitched' && (
                                <div className="mt-0.5 truncate text-[9px] opacity-65">
                                  {scheduleVersion?.version_label ?? `版本 #${schedule.schedule_version}`}
                                </div>
                              )}
                              {crossWarnings.length > 0 && (
                                <AlertTriangle className="absolute bottom-1.5 right-1.5 h-3 w-3 text-amber-600" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : isCurrentMonth ? (
                      <div className="mt-3 text-center text-[10px] text-muted-foreground/70">未排班</div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          {(isLoading || isFetching) && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />載入月班表
              </div>
            </div>
          )}

          {isError && !isFetching && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 text-sm text-muted-foreground">
              月班表載入失敗
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>重新載入</Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {displayMode === 'current'
            ? '目前版本模式只顯示所選版本；其他版本僅用於衝突警示。'
            : '跨版本拼接模式會顯示並下載相同機構、相同 A/B 軌的所有非封存版本。'}
          未排班不代表已核准休假。
        </p>
      </DialogContent>
    </Dialog>
  )
}
