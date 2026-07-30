import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  Loader2,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { employeesApi } from '@/api/endpoints/employees'
import { scheduleVersionsApi, schedulesApi } from '@/api/endpoints/schedules'
import { useBranches, useOrganizations } from '@/hooks/useOrganizations'
import { cn } from '@/lib/utils'
import type { EmployeeListItem } from '@/types/employee'
import type { Schedule, ScheduleVersion, ScheduleVersionType } from '@/types/schedule'

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

const shiftChipColors = [
  'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
  'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
  'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300',
  'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
  'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
]

type CellResolution = {
  version: ScheduleVersion | null
  conflicts: ScheduleVersion[]
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(date: Date) {
  const weekday = date.getDay()
  const offset = weekday === 0 ? -6 : 1 - weekday
  const result = new Date(date)
  result.setDate(date.getDate() + offset)
  result.setHours(0, 0, 0, 0)
  return result
}

function addDays(date: Date, amount: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

function employeeName(employee: EmployeeListItem) {
  return employee.user_name
    || `${employee.user.first_name} ${employee.user.last_name}`.trim()
    || employee.user.username
}

function versionAppliesToEmployee(version: ScheduleVersion, employee: EmployeeListItem) {
  return version.branch === null || version.branch === employee.branch
}

function shiftColorIndex(schedule: Schedule) {
  return Math.abs(schedule.shift_template.id) % shiftChipColors.length
}

export default function ApprovalScheduleSummaryPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTrack = searchParams.get('track')
  const [orgId, setOrgId] = useState(searchParams.get('organization') ?? '')
  const [branchId, setBranchId] = useState(searchParams.get('branch') ?? 'all')
  const [track, setTrack] = useState<ScheduleVersionType>(
    initialTrack === 'legal' ? 'legal' : 'actual',
  )
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))

  const orgIdResolved = useMemo(() => {
    const parsed = Number(orgId)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [orgId])
  const branchIdResolved = useMemo(() => {
    if (branchId === 'all') return null
    const parsed = Number(branchId)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [branchId])

  const { data: organizationsData } = useOrganizations()
  const organizations = organizationsData?.results ?? []
  const { data: branchesData } = useBranches({
    organization: orgIdResolved ?? undefined,
  })
  const branches = branchesData?.results ?? []

  useEffect(() => {
    if (!orgId && organizations.length === 1) {
      setOrgId(String(organizations[0].id))
    }
  }, [orgId, organizations])

  useEffect(() => {
    if (branchIdResolved && !branches.some((branch) => branch.id === branchIdResolved)) {
      setBranchId('all')
    }
  }, [branchIdResolved, branches])

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  )
  const dateFrom = formatDate(weekDays[0])
  const dateTo = formatDate(weekDays[6])

  const {
    data: approvedVersionsData,
    isLoading: versionsLoading,
    isFetching: versionsFetching,
    isError: versionsError,
    refetch: refetchVersions,
  } = useQuery({
    queryKey: ['scheduleVersions', 'approved-summary', orgIdResolved, track],
    queryFn: () => scheduleVersionsApi.listAll({
      organization: orgIdResolved ?? undefined,
      version_type: track,
      status: 'approved',
    }),
    enabled: !!orgIdResolved,
  })
  const approvedVersions = approvedVersionsData?.results ?? []
  const filteredVersions = useMemo(
    () => approvedVersions.filter((version) => (
      branchIdResolved === null
        ? true
        : version.branch === null || version.branch === branchIdResolved
    )),
    [approvedVersions, branchIdResolved],
  )
  const visibleVersions = useMemo(
    () => filteredVersions.filter((version) => (
      version.period_start <= dateTo && version.period_end >= dateFrom
    )),
    [dateFrom, dateTo, filteredVersions],
  )

  const {
    data: employeesData,
    isLoading: employeesLoading,
    isFetching: employeesFetching,
    isError: employeesError,
    refetch: refetchEmployees,
  } = useQuery({
    queryKey: ['employees', 'approved-summary', orgIdResolved, branchIdResolved],
    queryFn: () => employeesApi.listAll({
      organization: orgIdResolved ?? undefined,
      branch: branchIdResolved ?? undefined,
      is_active: true,
    }),
    enabled: !!orgIdResolved,
  })
  const employees = useMemo(
    () => [...(employeesData?.results ?? [])].sort((a, b) => (
      a.employee_id.localeCompare(b.employee_id)
    )),
    [employeesData?.results],
  )

  const scheduleQueries = useQueries({
    queries: visibleVersions.map((version) => ({
      queryKey: ['schedules', 'approved-summary', version.id, dateFrom, dateTo],
      queryFn: () => schedulesApi.listAll({
        version: version.id,
        date_from: dateFrom,
        date_to: dateTo,
      }),
    })),
  })
  const allSchedules = useMemo(
    () => scheduleQueries.flatMap((query) => query.data?.results ?? []),
    [scheduleQueries],
  )

  const resolutionByCell = useMemo(() => {
    const map = new Map<string, CellResolution>()
    for (const employee of employees) {
      for (const day of weekDays) {
        const date = formatDate(day)
        const candidates = visibleVersions.filter((version) => (
          version.period_start <= date
          && version.period_end >= date
          && versionAppliesToEmployee(version, employee)
        ))
        map.set(`${employee.id}:${date}`, {
          version: candidates.length === 1 ? candidates[0] : null,
          conflicts: candidates.length > 1 ? candidates : [],
        })
      }
    }
    return map
  }, [employees, visibleVersions, weekDays])

  const schedulesByCell = useMemo(() => {
    const map = new Map<string, Schedule[]>()
    for (const schedule of allSchedules) {
      const key = `${schedule.employee.id}:${schedule.schedule_date}`
      const resolution = resolutionByCell.get(key)
      if (!resolution?.version || resolution.version.id !== schedule.schedule_version) continue
      const values = map.get(key) ?? []
      values.push(schedule)
      values.sort((a, b) => a.shift_template.start_time.localeCompare(b.shift_template.start_time))
      map.set(key, values)
    }
    return map
  }, [allSchedules, resolutionByCell])

  const conflictDates = useMemo(
    () => weekDays
      .filter((day) => {
        const date = formatDate(day)
        return employees.some((employee) => (
          (resolutionByCell.get(`${employee.id}:${date}`)?.conflicts.length ?? 0) > 1
        ))
      })
      .map(formatDate),
    [employees, resolutionByCell, weekDays],
  )

  const visibleSchedules = useMemo(
    () => [...schedulesByCell.values()].flat(),
    [schedulesByCell],
  )
  const scheduledEmployeeCount = useMemo(
    () => new Set(visibleSchedules.map((schedule) => schedule.employee.id)).size,
    [visibleSchedules],
  )
  const totalHours = useMemo(
    () => visibleSchedules.reduce((sum, schedule) => {
      const hours = Number(schedule.expected_hours || schedule.shift_template.duration_hours || 0)
      return sum + (Number.isFinite(hours) ? hours : 0)
    }, 0),
    [visibleSchedules],
  )

  const dayVersionSignatures = useMemo(
    () => weekDays.map((day) => {
      const date = formatDate(day)
      return visibleVersions
        .filter((version) => version.period_start <= date && version.period_end >= date)
        .map((version) => version.id)
        .sort((a, b) => a - b)
        .join(',')
    }),
    [visibleVersions, weekDays],
  )

  const schedulesLoading = scheduleQueries.some((query) => query.isLoading || query.isFetching)
  const schedulesError = scheduleQueries.some((query) => query.isError)
  const isBusy = versionsLoading
    || versionsFetching
    || employeesLoading
    || employeesFetching
    || schedulesLoading
  const hasError = versionsError || employeesError || schedulesError

  const refetchAll = async () => {
    await Promise.all([
      refetchVersions(),
      refetchEmployees(),
      ...scheduleQueries.map((query) => query.refetch()),
    ])
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">簽核總表</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            將已簽核版本依日期拼接為唯讀班表，作為最終排班摘要
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => navigate('/schedules')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回排班管理
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4" />
            篩選簽核班表
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">機構（必選）</label>
              <Select
                value={orgId || undefined}
                onValueChange={(value) => {
                  setOrgId(value)
                  setBranchId('all')
                }}
              >
                <SelectTrigger><SelectValue placeholder="選擇機構" /></SelectTrigger>
                <SelectContent>
                  {organizations.map((organization) => (
                    <SelectItem key={organization.id} value={String(organization.id)}>
                      {organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">分店</label>
              <Select value={branchId} onValueChange={setBranchId} disabled={!orgIdResolved}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={String(branch.id)}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">班表軌別</label>
              <Select value={track} onValueChange={(value) => setTrack(value as ScheduleVersionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="actual">B 實際版</SelectItem>
                  <SelectItem value="legal">A 法規版</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-muted-foreground">本週來源版本</div>
            <div className="mt-1 text-2xl font-bold">{visibleVersions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />已排班員工</div>
            <div className="mt-1 text-2xl font-bold">{scheduledEmployeeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />本週預計工時</div>
            <div className="mt-1 text-2xl font-bold">{Math.round(totalHours * 10) / 10}<span className="ml-1 text-xs font-normal text-muted-foreground">小時</span></div>
          </CardContent>
        </Card>
        <Card className={cn(conflictDates.length > 0 && 'border-destructive/40 bg-destructive/5')}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" />版本衝突日期</div>
            <div className={cn('mt-1 text-2xl font-bold', conflictDates.length > 0 && 'text-destructive')}>{conflictDates.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>已簽核週班表</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">唯讀顯示，不會修改任何排班版本</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" aria-label="上一週" onClick={() => setWeekStart((current) => addDays(current, -7))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-44 text-center text-sm font-medium">{dateFrom} ～ {dateTo}</div>
              <Button type="button" variant="outline" size="sm" aria-label="下一週" onClick={() => setWeekStart((current) => addDays(current, 7))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visibleVersions.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              <span className="font-medium">本週拼接來源：</span>
              {visibleVersions.map((version) => (
                <Badge key={version.id} variant="outline" className="border-blue-200 bg-background">
                  {version.version_label}
                  {branchId === 'all' && version.branch_name ? ` · ${version.branch_name}` : ''}
                </Badge>
              ))}
            </div>
          )}

          {conflictDates.length > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="text-sm font-medium">已簽核版本期間重疊</div>
                <div className="mt-0.5 text-xs opacity-80">
                  衝突日期：{conflictDates.join('、')}。總表不會任意選擇版本，相關格子暫不顯示班次。
                </div>
              </div>
            </div>
          )}

          {!orgIdResolved ? (
            <div className="py-16 text-center text-muted-foreground">請先指定機構</div>
          ) : hasError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
              簽核總表載入失敗
              <Button type="button" variant="outline" size="sm" onClick={refetchAll}>重新載入</Button>
            </div>
          ) : isBusy ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : visibleVersions.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              此週尚無符合條件的已簽核版本
            </div>
          ) : employees.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">沒有符合條件的在職員工</div>
          ) : (
            <div className="overflow-auto rounded-lg border">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="sticky top-0 border-b bg-background/95 backdrop-blur">
                  <tr>
                    <th className="w-60 p-3 text-left">員工</th>
                    {weekDays.map((day, index) => {
                      const date = formatDate(day)
                      const dayVersions = visibleVersions.filter((version) => (
                        version.period_start <= date && version.period_end >= date
                      ))
                      const isBoundary = index > 0 && dayVersionSignatures[index] !== dayVersionSignatures[index - 1]
                      return (
                        <th
                          key={date}
                          className={cn(
                            'min-w-32 p-3 text-left',
                            (index === 5 || index === 6) && 'bg-primary/[0.025]',
                            !dayVersions.length && 'bg-muted/40',
                            isBoundary && 'border-l-2 border-l-primary/50',
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">週{weekdayLabels[index]}</span>
                            <span className="text-xs text-muted-foreground">{date.slice(5)}</span>
                          </div>
                          <div className="mt-1 truncate text-[10px] font-normal text-primary/70">
                            {!dayVersions.length
                              ? '尚無簽核版本'
                              : dayVersions.length === 1
                                ? dayVersions[0].version_label
                                : `${dayVersions.length} 個來源版本`}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="p-3 align-top">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {employeeName(employee).slice(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{employeeName(employee)}</div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {employee.employee_id} · {employee.position}
                              {branchId === 'all' && employee.branch_name ? ` · ${employee.branch_name}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      {weekDays.map((day, dayIndex) => {
                        const date = formatDate(day)
                        const key = `${employee.id}:${date}`
                        const resolution = resolutionByCell.get(key)
                        const cellSchedules = schedulesByCell.get(key) ?? []
                        const hasConflict = (resolution?.conflicts.length ?? 0) > 1
                        const previousKey = dayIndex > 0
                          ? `${employee.id}:${formatDate(weekDays[dayIndex - 1])}`
                          : null
                        const previousVersion = previousKey ? resolutionByCell.get(previousKey)?.version : null
                        const isBoundary = dayIndex > 0 && resolution?.version?.id !== previousVersion?.id

                        return (
                          <td
                            key={date}
                            className={cn(
                              'p-1.5 align-top',
                              (dayIndex === 5 || dayIndex === 6) && 'bg-primary/[0.02]',
                              !resolution?.version && !hasConflict && 'bg-muted/30',
                              hasConflict && 'bg-destructive/5',
                              isBoundary && 'border-l-2 border-l-primary/50',
                            )}
                          >
                            {hasConflict ? (
                              <div className="flex min-h-16 items-center justify-center rounded-md border border-destructive/30 bg-destructive/5 px-2 text-center text-[10px] font-medium text-destructive">
                                <AlertTriangle className="mr-1 h-3 w-3 shrink-0" />
                                版本衝突
                              </div>
                            ) : cellSchedules.length > 0 ? (
                              <div className="space-y-1">
                                {cellSchedules.map((schedule) => (
                                  <div
                                    key={schedule.id}
                                    className={cn(
                                      'rounded-md border px-2 py-2',
                                      shiftChipColors[shiftColorIndex(schedule)],
                                    )}
                                    title={`來源版本：${resolution?.version?.version_label ?? ''}`}
                                  >
                                    <div className="truncate text-xs font-semibold">{schedule.shift_template.name}</div>
                                    <div className="mt-0.5 whitespace-nowrap font-mono text-[10px] opacity-75">
                                      {schedule.shift_template.start_time.slice(0, 5)}-{schedule.shift_template.end_time.slice(0, 5)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : resolution?.version ? (
                              <div className="flex min-h-16 items-center justify-center text-[10px] text-muted-foreground/65">未排班</div>
                            ) : (
                              <div className="flex min-h-16 items-center justify-center text-center text-[10px] text-muted-foreground/55">尚無簽核版本</div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
