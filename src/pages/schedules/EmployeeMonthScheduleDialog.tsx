import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useQueries } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock3, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { schedulesApi } from '@/api/endpoints/schedules'
import { cn } from '@/lib/utils'
import {
  getTimelineVersions,
  resolveVersionForDate,
} from '@/lib/scheduleVersionTimeline'
import type { EmployeeListItem } from '@/types/employee'
import type { ComplianceViolation, Schedule, ScheduleVersion } from '@/types/schedule'
import type { ShiftTemplate } from '@/types/shift'

type DialogOrigin = {
  x: number
  y: number
}

type EmployeeMonthScheduleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeListItem
  versionId: number
  versionLabel: string
  periodStart: string
  periodEnd: string
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

export function EmployeeMonthScheduleDialog({
  open,
  onOpenChange,
  employee,
  versionId,
  versionLabel,
  periodStart,
  periodEnd,
  initialMonth,
  origin,
  templates,
  violations,
  versions,
}: EmployeeMonthScheduleDialogProps) {
  const [month, setMonth] = useState(() => startOfMonth(initialMonth))

  useEffect(() => {
    if (open) {
      setMonth(startOfMonth(initialMonth))
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
    () => getTimelineVersions(
      versions,
      selectedVersion,
      formatDate(calendarStart),
      formatDate(calendarEnd),
    ),
    [calendarEnd, calendarStart, selectedVersion, versions],
  )
  const scheduleQueries = useQueries({
    queries: open
      ? timelineVersions.map((version) => ({
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
  const schedules = useMemo(
    () => rawSchedules.filter((schedule) => (
      resolveVersionForDate(
        timelineVersions,
        selectedVersion?.id ?? null,
        schedule.schedule_date,
      ).version?.id === schedule.schedule_version
    )),
    [rawSchedules, selectedVersion?.id, timelineVersions],
  )
  const isLoading = scheduleQueries.some((query) => query.isLoading)
  const isFetching = scheduleQueries.some((query) => query.isFetching)
  const isError = scheduleQueries.some((query) => query.isError)
  const refetch = () => Promise.all(scheduleQueries.map((query) => query.refetch()))
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
  const versionResolutionByDate = useMemo(() => {
    const map = new Map<string, ReturnType<typeof resolveVersionForDate>>()
    for (const day of calendarDays) {
      const date = formatDate(day)
      map.set(date, resolveVersionForDate(
        timelineVersions,
        selectedVersion?.id ?? null,
        date,
      ))
    }
    return map
  }, [calendarDays, selectedVersion?.id, timelineVersions])
  const visibleOwnerVersions = useMemo(() => {
    const map = new Map<number, ScheduleVersion>()
    for (const day of calendarDays) {
      const owner = versionResolutionByDate.get(formatDate(day))?.version
      if (owner) map.set(owner.id, owner)
    }
    return [...map.values()].sort((a, b) => a.period_start.localeCompare(b.period_start))
  }, [calendarDays, versionResolutionByDate])
  const conflictDates = useMemo(
    () => calendarDays
      .filter((day) => (
        (versionResolutionByDate.get(formatDate(day))?.conflicts.length ?? 0) > 1
      ))
      .map(formatDate),
    [calendarDays, versionResolutionByDate],
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
  const monthHasVersion = timelineVersions.some((version) => (
    version.period_start <= formatDate(monthEnd)
    && version.period_end >= formatDate(monthStart)
  ))
  const name = employeeName(employee)

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
          <div className={cn('rounded-lg border px-3 py-2.5', relevantViolations.length ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40' : 'bg-muted/30')}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" />合規提醒</div>
            <div className="mt-1 text-xl font-bold">{relevantViolations.length}<span className="ml-1 text-xs font-normal text-muted-foreground">項</span></div>
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
        </div>

        {visibleOwnerVersions.length > 1 && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 text-blue-900">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="text-sm font-medium">
                本頁月曆由 {visibleOwnerVersions.length} 個連續版本拼接顯示
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-blue-800/80">
                {visibleOwnerVersions.map((version) => (
                  <span key={version.id} className="rounded-full border border-blue-200 bg-background px-2 py-0.5">
                    {version.version_label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {conflictDates.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="text-sm font-medium">本月存在重疊的排班版本</div>
              <div className="mt-0.5 text-xs opacity-80">
                衝突日期：{conflictDates.join('、')}
              </div>
            </div>
          </div>
        )}

        {!monthHasVersion && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-amber-900">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="text-sm font-medium">此月份尚無排班版本</div>
              <div className="mt-0.5 text-xs text-amber-800/80">
                目前操作版本為「{versionLabel}」（{periodStart} ～ {periodEnd}）；此月份僅供瀏覽。
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
                const resolution = versionResolutionByDate.get(dateKey)
                const ownerVersion = resolution?.version
                const hasConflict = (resolution?.conflicts.length ?? 0) > 1
                const previousOwner = index > 0
                  ? versionResolutionByDate.get(formatDate(calendarDays[index - 1]))?.version
                  : null
                const isVersionBoundary = index > 0 && ownerVersion?.id !== previousOwner?.id
                const daySchedules = scheduleByDate.get(dateKey) ?? []

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      'min-h-24 border-b border-r p-1.5 last:border-r-0',
                      (index % 7 === 0 || index % 7 === 6) && isCurrentMonth && 'bg-primary/[0.025]',
                      !isCurrentMonth && 'bg-muted/20 text-muted-foreground/50',
                      !ownerVersion && 'bg-muted/30',
                      isVersionBoundary && 'border-l-2 border-l-primary/50',
                      hasConflict && 'bg-destructive/5',
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

                    {ownerVersion && !hasConflict && daySchedules.length ? (
                      <div className={cn('mt-1 space-y-1', !isCurrentMonth && 'opacity-70')}>
                        {daySchedules.map((schedule) => {
                          const templateIndex = templateIndexById.get(schedule.shift_template.id) ?? schedule.shift_template.id
                          const violation = violationByCell.get(`${dateKey}:${schedule.shift_template.id}`)
                          return (
                            <div
                              key={schedule.id}
                              className={cn(
                                'rounded-md border px-2 py-1.5',
                                shiftChipColors[templateIndex % shiftChipColors.length],
                                violation?.severity === 'hard' && 'border-destructive ring-1 ring-destructive/40',
                                violation?.severity === 'soft' && 'border-amber-400 ring-1 ring-amber-300/50',
                              )}
                              title={[
                                ownerVersion.id !== versionId ? `來自版本：${ownerVersion.version_label}` : '',
                                violation ? `${violation.rule_label}：${JSON.stringify(violation.detail)}` : '',
                              ].filter(Boolean).join('\n') || undefined}
                            >
                              <div className="truncate text-xs font-semibold">{schedule.shift_template.name}</div>
                              <div className="mt-0.5 whitespace-nowrap font-mono text-[10px] opacity-75">
                                {schedule.shift_template.start_time.slice(0, 5)}-{schedule.shift_template.end_time.slice(0, 5)}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : hasConflict ? (
                      <div className="mt-3 text-center text-[10px] text-destructive">版本衝突</div>
                    ) : isCurrentMonth && ownerVersion ? (
                      <div className="mt-3 text-center text-[10px] text-muted-foreground/70">未排班</div>
                    ) : isCurrentMonth && !ownerVersion ? (
                      <div className="mt-3 text-center text-[10px] text-muted-foreground/55">尚無版本</div>
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
          連續瀏覽會拼接同一分店、同一軌的相鄰版本；未排班不代表已核准休假。
        </p>
      </DialogContent>
    </Dialog>
  )
}
