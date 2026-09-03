import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { employeesApi } from '@/api/endpoints/employees'
import { scheduleVersionsApi } from '@/api/endpoints/schedules'
import { useDecideScheduleOverlap } from '@/hooks/useSchedules'
import { useLeaveRequests } from '@/hooks/useLeaves'
import { useBranches, useOrganizations } from '@/hooks/useOrganizations'
import { cn } from '@/lib/utils'
import type { EmployeeListItem } from '@/types/employee'
import type {
  ApprovedTimelineConflict,
  Schedule,
  ScheduleOverlapDecisionType,
} from '@/types/schedule'
import { approvedLeaveDateMap, approvedLeaveFor, isWorkingSchedule, workingSchedules } from '@/lib/leaveDates'

const weekdayLabels = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']

const shiftChipColors = [
  'border-sky-200 bg-sky-50 text-sky-700',
  'border-amber-200 bg-amber-50 text-amber-700',
  'border-violet-200 bg-violet-50 text-violet-700',
  'border-indigo-200 bg-indigo-50 text-indigo-700',
  'border-rose-200 bg-rose-50 text-rose-700',
  'border-emerald-200 bg-emerald-50 text-emerald-700',
]

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

function intervalLabel(conflict: ApprovedTimelineConflict) {
  const start = new Date(conflict.starts_at)
  const end = new Date(conflict.ends_at)
  const time = (value: Date) => value.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${formatDate(start)} ${time(start)}–${time(end)}`
}

export default function ApprovalScheduleSummaryPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [orgId, setOrgId] = useState(searchParams.get('organization') ?? '')
  const [branchId, setBranchId] = useState(searchParams.get('branch') ?? 'all')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [activeConflict, setActiveConflict] = useState<ApprovedTimelineConflict | null>(null)
  const [decisionType, setDecisionType] = useState<ScheduleOverlapDecisionType>('select')
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<number[]>([])
  const [decisionComment, setDecisionComment] = useState('')

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
  const { data: branchesData } = useBranches({ organization: orgIdResolved ?? undefined })
  const branches = branchesData?.results ?? []

  useEffect(() => {
    if (!orgId && organizations.length === 1) setOrgId(String(organizations[0].id))
  }, [orgId, organizations])

  useEffect(() => {
    if (branchIdResolved && !branches.some((branch) => branch.id === branchIdResolved)) setBranchId('all')
  }, [branchIdResolved, branches])

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  )
  const dateFrom = formatDate(weekDays[0])
  const dateTo = formatDate(weekDays[6])

  const approvedLeavesQuery = useLeaveRequests({
    status: 'approved',
    date_from: dateFrom,
    date_to: dateTo,
  }, { enabled: !!orgIdResolved, allPages: true })
  const approvedLeaves = approvedLeavesQuery.data?.results ?? []
  const leaveDateMap = useMemo(() => approvedLeaveDateMap(approvedLeaves), [approvedLeaves])

  const timelineQuery = useQuery({
    queryKey: ['approvedScheduleTimeline', orgIdResolved, branchId, dateFrom, dateTo],
    queryFn: () => scheduleVersionsApi.approvedTimeline({
      organization: orgIdResolved!,
      branch: branchId === 'all' ? 'all' : Number(branchId),
      version_type: 'actual',
      date_from: dateFrom,
      date_to: dateTo,
    }),
    enabled: !!orgIdResolved,
  })

  const employeesQuery = useQuery({
    queryKey: ['employees', 'approved-summary', orgIdResolved, branchIdResolved],
    queryFn: () => employeesApi.listAll({
      organization: orgIdResolved ?? undefined,
      branch: branchIdResolved ?? undefined,
      is_active: true,
    }),
    enabled: !!orgIdResolved,
  })

  const employees = useMemo(
    () => [...(employeesQuery.data?.results ?? [])].sort((a, b) => a.employee_id.localeCompare(b.employee_id)),
    [employeesQuery.data?.results],
  )
  const timeline = timelineQuery.data
  const conflicts = useMemo(
    () => (timeline?.conflicts ?? []).filter((conflict) => conflict.schedules.every(isWorkingSchedule)),
    [timeline?.conflicts],
  )
  const versionById = useMemo(
    () => new Map((timeline?.versions ?? []).map((version) => [version.id, version])),
    [timeline?.versions],
  )
  const conflictByScheduleId = useMemo(() => {
    const map = new Map<number, ApprovedTimelineConflict>()
    conflicts.forEach((conflict) => conflict.schedule_ids.forEach((id) => map.set(id, conflict)))
    return map
  }, [conflicts])

  const finalSchedules = useMemo(() => (timeline?.schedules ?? []).filter((schedule) => {
    if (schedule.status === 'cancelled') return false
    const conflict = conflictByScheduleId.get(schedule.id)
    if (!conflict?.decision || conflict.decision.decision === 'coexist') return true
    return conflict.decision.selected_schedule_ids.includes(schedule.id)
  }), [conflictByScheduleId, timeline?.schedules])

  const schedulesByCell = useMemo(() => {
    const map = new Map<string, Schedule[]>()
    finalSchedules.forEach((schedule) => {
      if (schedule.schedule_date < dateFrom || schedule.schedule_date > dateTo) return
      const key = `${schedule.employee.id}:${schedule.schedule_date}`
      const values = map.get(key) ?? []
      values.push(schedule)
      values.sort((a, b) => a.shift_template.start_time.localeCompare(b.shift_template.start_time))
      map.set(key, values)
    })
    return map
  }, [dateFrom, dateTo, finalSchedules])

  const scheduledEmployeeCount = useMemo(
    () => new Set(workingSchedules(finalSchedules).map((schedule) => schedule.employee.id)).size,
    [finalSchedules],
  )
  const totalHours = useMemo(() => workingSchedules(finalSchedules).reduce((sum, schedule) => {
    const value = Number(schedule.expected_hours || schedule.shift_template.duration_hours || 0)
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0), [finalSchedules])
  const decideOverlap = useDecideScheduleOverlap()

  const openDecision = (conflict: ApprovedTimelineConflict) => {
    setActiveConflict(conflict)
    setDecisionType(conflict.decision?.decision ?? 'select')
    setSelectedScheduleIds(conflict.decision?.selected_schedule_ids ?? conflict.schedule_ids.slice(0, 1))
    setDecisionComment(conflict.decision?.comment ?? '')
  }

  const saveDecision = async () => {
    if (!activeConflict) return
    if (decisionType === 'select' && selectedScheduleIds.length === 0) return
    if (decisionType === 'coexist' && !decisionComment.trim()) return
    await decideOverlap.mutateAsync({
      conflict_key: activeConflict.conflict_key,
      schedule_ids: activeConflict.schedule_ids,
      decision: decisionType,
      selected_schedule_ids: decisionType === 'select' ? selectedScheduleIds : activeConflict.schedule_ids,
      comment: decisionComment.trim(),
    })
    setActiveConflict(null)
  }

  const loading = timelineQuery.isLoading || employeesQuery.isLoading || approvedLeavesQuery.isLoading
  const fetching = timelineQuery.isFetching || employeesQuery.isFetching || approvedLeavesQuery.isFetching
  const hasError = timelineQuery.isError || employeesQuery.isError || approvedLeavesQuery.isError
  const unresolvedCount = conflicts.filter((conflict) => !conflict.decision).length

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/schedules')} aria-label="返回排班管理">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">簽核總表</h1>
              <p className="text-sm text-muted-foreground">整合所有已簽核版本，並在此確認跨版本重疊時段。</p>
            </div>
          </div>
        </div>
        <Badge variant={unresolvedCount ? 'destructive' : 'default'} className="mt-2">
          {unresolvedCount ? `${unresolvedCount} 項待裁決` : '重疊時段皆已確認'}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">篩選條件</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>機構</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger><SelectValue placeholder="選擇機構" /></SelectTrigger>
              <SelectContent>{organizations.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>分店</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {branches.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><FileCheck2 className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">已拼接版本</p><p className="text-xl font-semibold">{timeline?.versions.length ?? 0}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Users className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">本週排班員工</p><p className="text-xl font-semibold">{scheduledEmployeeCount}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Clock3 className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">目前採計工時</p><p className="text-xl font-semibold">{totalHours.toFixed(1)}</p></div></CardContent></Card>
      </div>

      {conflicts.length > 0 && (
        <Card className={cn(unresolvedCount ? 'border-amber-300 bg-amber-50/40' : 'border-emerald-200 bg-emerald-50/30')}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {unresolvedCount ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              重疊時段確認
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {conflicts.map((conflict) => {
              const first = conflict.schedules[0]
              return (
                <div key={conflict.conflict_key} className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
                  <div>
                    <p className="font-medium">{first?.employee.user_name ?? `員工 #${conflict.employee_id}`}</p>
                    <p className="text-sm text-muted-foreground">{intervalLabel(conflict)} · {conflict.schedules.length} 筆班次重疊</p>
                    {conflict.decision && (
                      <p className="mt-1 text-xs text-emerald-700">
                        已裁決：{conflict.decision.decision === 'coexist' ? `允許並存 · ${conflict.decision.comment}` : '保留指定班次'}
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant={conflict.decision ? 'outline' : 'default'} onClick={() => openDecision(conflict)}>
                    {conflict.decision ? '修改裁決' : '進行裁決'}
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">週排班總表</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-48 text-center text-sm font-medium">{dateFrom} ～ {dateTo}</span>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : hasError ? (
            <div className="py-12 text-center">
              <p className="text-sm text-destructive">無法載入簽核總表。</p>
              <Button className="mt-3" variant="outline" onClick={() => { timelineQuery.refetch(); employeesQuery.refetch(); approvedLeavesQuery.refetch() }}>重試</Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead><tr className="bg-muted/50"><th className="w-52 border-b p-3 text-left">員工</th>{weekDays.map((day, index) => <th key={formatDate(day)} className="border-b p-3 text-left"><span>{weekdayLabels[index]}</span><span className="ml-2 text-muted-foreground">{formatDate(day).slice(5)}</span></th>)}</tr></thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} className="border-b last:border-0">
                      <td className="p-3 align-top"><p className="font-medium">{employeeName(employee)}</p><p className="text-xs text-muted-foreground">{employee.employee_id} · {employee.position}</p></td>
                      {weekDays.map((day) => {
                        const date = formatDate(day)
                        const schedules = schedulesByCell.get(`${employee.id}:${date}`) ?? []
                        const leaves = approvedLeaveFor(leaveDateMap, employee.id, date)
                        const showLeaveOverlay = leaves.length > 0 && !schedules.some((schedule) => schedule.status === 'leave')
                        return (
                          <td key={date} className="p-1.5 align-top">
                            {(schedules.length || showLeaveOverlay) ? <div className="space-y-1">{schedules.map((schedule) => {
                              const isLeave = schedule.status === 'leave'
                              const version = versionById.get(schedule.schedule_version)
                              const conflict = conflictByScheduleId.get(schedule.id)
                              const unresolved = !!conflict && !conflict.decision
                              const coexist = conflict?.decision?.decision === 'coexist'
                              return (
                                <button
                                  key={schedule.id}
                                  type="button"
                                  onClick={() => conflict && openDecision(conflict)}
                                  className={cn(
                                    'relative w-full rounded-md border p-2 text-left',
                                    isLeave
                                      ? 'border-violet-300 bg-violet-100 text-violet-800'
                                      : shiftChipColors[Math.abs(schedule.shift_template.id) % shiftChipColors.length],
                                    unresolved && 'border-destructive bg-destructive/10 ring-1 ring-destructive/30',
                                    coexist && 'border-emerald-400 ring-1 ring-emerald-200',
                                  )}
                                >
                                  <p className="pr-4 text-xs font-semibold">{isLeave ? '請假' : schedule.shift_template.name}</p>
                                  <p className="font-mono text-[10px] opacity-75">{isLeave ? `原排：${schedule.shift_template.name}` : `${schedule.shift_template.start_time.slice(0, 5)}–${schedule.shift_template.end_time.slice(0, 5)}`}</p>
                                  <p className="mt-1 truncate text-[10px] opacity-70">{version?.version_label ?? `版本 #${schedule.schedule_version}`}</p>
                                  {unresolved && <AlertTriangle className="absolute bottom-2 right-2 h-3.5 w-3.5 text-destructive" />}
                                  {coexist && <CheckCircle2 className="absolute bottom-2 right-2 h-3.5 w-3.5 text-emerald-600" />}
                                </button>
                              )
                            })}
                              {showLeaveOverlay && (
                                <button
                                  type="button"
                                  className="w-full rounded-md border border-violet-300 bg-violet-100 p-2 text-left text-violet-800"
                                  onClick={() => navigate('/leaves')}
                                  title={leaves.map((leave) => `${leave.leave_type_display}：${leave.start_date}～${leave.end_date}`).join('\n')}
                                >
                                  <p className="text-xs font-semibold">請假</p>
                                  <p className="mt-0.5 truncate text-[10px] opacity-75">{leaves.map((leave) => leave.leave_type_display).join('、')}</p>
                                </button>
                              )}
                            </div> : <div className="rounded-md border border-dashed py-5 text-center text-xs text-muted-foreground">未排班</div>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {fetching && !loading && <p className="mt-2 text-right text-xs text-muted-foreground">正在更新…</p>}
        </CardContent>
      </Card>

      <Dialog open={!!activeConflict} onOpenChange={(open) => { if (!open) setActiveConflict(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>確認重疊時段</DialogTitle>
            <DialogDescription>{activeConflict ? intervalLabel(activeConflict) : ''}。可保留一或多筆彼此不重疊的班次；若重疊班次都要保留，請選擇允許全部並存。</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={decisionType === 'select' ? 'default' : 'outline'} onClick={() => setDecisionType('select')}>保留指定班次</Button>
            <Button type="button" variant={decisionType === 'coexist' ? 'default' : 'outline'} onClick={() => setDecisionType('coexist')}>允許全部並存</Button>
          </div>
          <div className="space-y-2">
            {activeConflict?.schedules.map((schedule) => {
              const selected = decisionType === 'select' && selectedScheduleIds.includes(schedule.id)
              const version = versionById.get(schedule.schedule_version)
              return (
                <button
                  key={schedule.id}
                  type="button"
                  disabled={decisionType === 'coexist'}
                  onClick={() => setSelectedScheduleIds((current) => (
                    current.includes(schedule.id)
                      ? current.filter((id) => id !== schedule.id)
                      : [...current, schedule.id]
                  ))}
                  className={cn('w-full rounded-md border p-3 text-left transition', selected && 'border-primary bg-primary/5 ring-1 ring-primary', decisionType === 'coexist' && 'bg-muted/40')}
                >
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">{schedule.shift_template.name}</span><Badge variant="outline">{version?.version_label ?? `#${schedule.schedule_version}`}</Badge></div>
                  <p className="mt-1 text-sm text-muted-foreground">{schedule.schedule_date} · {schedule.shift_template.start_time.slice(0, 5)}–{schedule.shift_template.end_time.slice(0, 5)}</p>
                </button>
              )
            })}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decision-comment">備註{decisionType === 'coexist' ? '（允許並存時必填）' : '（選填）'}</Label>
            <Input id="decision-comment" value={decisionComment} onChange={(event) => setDecisionComment(event.target.value)} placeholder={decisionType === 'coexist' ? '請說明允許重疊的原因' : '補充裁決說明'} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActiveConflict(null)}>取消</Button>
            <Button type="button" disabled={decideOverlap.isPending || (decisionType === 'select' ? selectedScheduleIds.length === 0 : !decisionComment.trim())} onClick={saveDecision}>
              {decideOverlap.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存裁決
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
