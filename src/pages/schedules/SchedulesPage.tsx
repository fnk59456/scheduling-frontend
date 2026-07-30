import { useEffect, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Settings2,
  CheckCircle, Clock, ShieldCheck, ShieldAlert, ArrowRight, AlertTriangle,
  CalendarDays, Download, FileCheck2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrganizations, useBranches } from '@/hooks/useOrganizations'
import { useEmployees } from '@/hooks/useEmployees'
import { useShiftRules, useShiftTemplates } from '@/hooks/useShifts'
import {
  useScheduleVersions,
  useCreateScheduleVersion,
  useApproveScheduleVersion,
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  useCheckCompliance,
  useDeriveLegal,
  useUpdateScheduleVersion,
} from '@/hooks/useSchedules'
import type {
  Schedule,
  ScheduleCreateRequest,
  ScheduleStatus,
  ScheduleVersion,
  ScheduleVersionCreateRequest,
  ComplianceViolation,
  CheckComplianceResult,
  DeriveLegalResult,
} from '@/types/schedule'
import { toast } from '@/hooks/use-toast'
import { scheduleVersionsApi, schedulesApi } from '@/api/endpoints/schedules'
import { employeesApi } from '@/api/endpoints/employees'
import { cn } from '@/lib/utils'
import {
  getTimelineVersions,
  resolveVersionForDate,
} from '@/lib/scheduleVersionTimeline'
import { EmployeeMonthScheduleDialog } from './EmployeeMonthScheduleDialog'
import type { EmployeeListItem } from '@/types/employee'
import type { ScheduleExportLayout } from '@/lib/scheduleExcelExport'

function fmtDate(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseDate(s: string) {
  const [y, m, d] = s.split('-').map((x) => Number(x))
  return new Date(y, (m || 1) - 1, d || 1)
}

function startOfWeek(d: Date) {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  const x = new Date(d)
  x.setDate(d.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(d.getDate() + days)
  return x
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function inclusiveDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

function isWithinPeriod(d: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return true
  const time = d.getTime()
  return time >= start.getTime() && time <= end.getTime()
}

function buildVersionLabel(start: Date, end: Date) {
  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      return `${start.getFullYear()} ${start.getMonth() + 1}月`
    }
    return `${start.getFullYear()} ${start.getMonth() + 1}~${end.getMonth() + 1}月`
  }
  return `${start.getFullYear()}/${start.getMonth() + 1}~${end.getFullYear()}/${end.getMonth() + 1}`
}

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

const shiftChipColors = [
  { bg: 'bg-sky-50',    border: 'border-sky-200',    text: 'text-sky-700',    dot: 'bg-sky-500' },
  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  { bg: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-700',   dot: 'bg-rose-500' },
  { bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-700',dot: 'bg-emerald-500' },
]

function violationCellKey(v: ComplianceViolation) {
  return `${v.employee_pk}:${v.schedule_date}:${v.shift_template_id ?? ''}`
}

function shiftIntervalMinutes(schedule: Schedule) {
  const [startHour, startMinute] = schedule.shift_template.start_time.split(':').map(Number)
  const [endHour, endMinute] = schedule.shift_template.end_time.split(':').map(Number)
  const start = startHour * 60 + startMinute
  let end = endHour * 60 + endMinute
  if (end <= start) end += 24 * 60
  return { start, end }
}

function numericRuleValue(value: Record<string, unknown>, fallback: number) {
  for (const key of ['max_hours', 'hours', 'value']) {
    const parsed = Number(value[key])
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return fallback
}

type WorkflowPhase = 'editing' | 'checking' | 'violations' | 'done'

export default function SchedulesPage() {
  const navigate = useNavigate()
  const { data: orgsData } = useOrganizations()

  const [orgId, setOrgId] = useState<string>('')
  const [branchId, setBranchId] = useState<string>('all')
  const [versionId, setVersionId] = useState<string>('none')

  const orgIdResolved = useMemo(() => {
    const n = Number(orgId)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [orgId])

  const { data: branchesData } = useBranches({
    organization: orgIdResolved ?? undefined,
  })

  const organizations = orgsData?.results ?? []
  const branches = branchesData?.results ?? []

  const { data: employeesData, isLoading: employeesLoading } = useEmployees({
    is_active: true,
    branch: branchId === 'all' ? undefined : Number(branchId),
  })
  const employees = employeesData?.results ?? []

  const { data: templatesData } = useShiftTemplates({
    organization: orgIdResolved ?? undefined,
    is_active: true,
  })
  const templates = templatesData?.results ?? []
  const { data: shiftRulesData } = useShiftRules({
    organization: orgIdResolved ?? undefined,
    is_active: true,
  })
  const maxDailyHours = useMemo(() => {
    const rule = shiftRulesData?.results.find((item) => item.rule_type === 'max_daily_hours')
    return rule ? numericRuleValue(rule.value, 8) : 8
  }, [shiftRulesData])

  // 查所有版本（不依版本類型篩選）
  const { data: versionsData, isLoading: versionsLoading, refetch: refetchVersions } = useScheduleVersions({
    organization: orgIdResolved ?? undefined,
  })
  const versions = versionsData?.results ?? []

  const selectedVersion = versions.find((v) => String(v.id) === versionId) ?? null

  const periodStart = selectedVersion ? parseDate(selectedVersion.period_start) : null
  const periodEnd = selectedVersion ? parseDate(selectedVersion.period_end) : null

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [versionNavigationDate, setVersionNavigationDate] = useState<string | null>(null)
  const [monthScheduleOpen, setMonthScheduleOpen] = useState(false)
  const [monthScheduleEmployee, setMonthScheduleEmployee] = useState<EmployeeListItem | null>(null)
  const [monthDialogOrigin, setMonthDialogOrigin] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!orgId && organizations.length === 1) {
      setOrgId(String(organizations[0].id))
    }
  }, [orgId, organizations])

  useEffect(() => {
    if (versionsLoading) return
    if (versionId === 'none' && versions.length > 0) {
      setVersionId(String(versions[0].id))
    }
  }, [versionsLoading, versionId, versions])

  useEffect(() => {
    if (!selectedVersion) return
    const requestedDate = versionNavigationDate ? parseDate(versionNavigationDate) : null
    const initialDate = requestedDate && isWithinPeriod(
      requestedDate,
      parseDate(selectedVersion.period_start),
      parseDate(selectedVersion.period_end),
    )
      ? requestedDate
      : parseDate(selectedVersion.period_start)
    setWeekStart(startOfWeek(initialDate))
    setVersionNavigationDate(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersion?.id])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const dateFrom = fmtDate(weekDays[0])
  const dateTo = fmtDate(weekDays[6])

  const {
    data: schedulesData,
    isLoading: schedulesLoading,
    refetch: refetchSchedules,
  } = useSchedules({
    version: selectedVersion?.id,
    date_from: selectedVersion ? dateFrom : undefined,
    date_to: selectedVersion ? dateTo : undefined,
  })

  const schedules = schedulesData?.results ?? []
  const timelineVersions = useMemo(
    () => getTimelineVersions(versions, selectedVersion, dateFrom, dateTo),
    [dateFrom, dateTo, selectedVersion, versions],
  )
  const adjacentVersions = useMemo(
    () => timelineVersions.filter((version) => version.id !== selectedVersion?.id),
    [selectedVersion?.id, timelineVersions],
  )
  const adjacentScheduleQueries = useQueries({
    queries: adjacentVersions.map((version) => ({
      queryKey: ['schedules', 'timeline', version.id, dateFrom, dateTo],
      queryFn: () => schedulesApi.listAll({
        version: version.id,
        date_from: dateFrom,
        date_to: dateTo,
      }),
    })),
  })
  const adjacentSchedules = useMemo(
    () => adjacentScheduleQueries.flatMap((query) => query.data?.results ?? []),
    [adjacentScheduleQueries],
  )
  const timelineSchedules = useMemo(
    () => [...schedules, ...adjacentSchedules],
    [adjacentSchedules, schedules],
  )
  const versionResolutionByDate = useMemo(() => {
    const map = new Map<string, ReturnType<typeof resolveVersionForDate>>()
    for (const day of weekDays) {
      const date = fmtDate(day)
      map.set(date, resolveVersionForDate(
        timelineVersions,
        selectedVersion?.id ?? null,
        date,
      ))
    }
    return map
  }, [selectedVersion?.id, timelineVersions, weekDays])
  const visibleOwnerVersions = useMemo(() => {
    const map = new Map<number, ScheduleVersion>()
    for (const resolution of versionResolutionByDate.values()) {
      if (resolution.version) map.set(resolution.version.id, resolution.version)
    }
    return [...map.values()].sort((a, b) => a.period_start.localeCompare(b.period_start))
  }, [versionResolutionByDate])
  const uncoveredWeekDays = useMemo(
    () => weekDays.filter((day) => !versionResolutionByDate.get(fmtDate(day))?.version),
    [versionResolutionByDate, weekDays],
  )
  const conflictWeekDays = useMemo(
    () => weekDays.filter((day) => (versionResolutionByDate.get(fmtDate(day))?.conflicts.length ?? 0) > 1),
    [versionResolutionByDate, weekDays],
  )

  const openEmployeeMonthSchedule = (employee: EmployeeListItem, trigger: HTMLButtonElement) => {
    const rect = trigger.getBoundingClientRect()
    setMonthDialogOrigin({
      x: rect.left + rect.width / 2 - window.innerWidth / 2,
      y: rect.top + rect.height / 2 - window.innerHeight / 2,
    })
    setMonthScheduleEmployee(employee)
    setMonthScheduleOpen(true)
  }

  const scheduleByEmployeeDate = useMemo(() => {
    const map = new Map<string, Schedule[]>()
    for (const s of timelineSchedules) {
      const owner = versionResolutionByDate.get(s.schedule_date)?.version
      if (!owner || owner.id !== s.schedule_version) continue
      const key = `${s.employee.id}:${s.schedule_date}`
      const values = map.get(key) ?? []
      values.push(s)
      map.set(key, values)
    }
    for (const values of map.values()) {
      values.sort((a, b) => a.shift_template.start_time.localeCompare(b.shift_template.start_time))
    }
    return map
  }, [timelineSchedules, versionResolutionByDate])

  const immediateWarningMap = useMemo(() => {
    const map = new Map<number, string[]>()
    const add = (schedule: Schedule, message: string) => {
      const messages = map.get(schedule.id) ?? []
      if (!messages.includes(message)) messages.push(message)
      map.set(schedule.id, messages)
    }
    for (const daySchedules of scheduleByEmployeeDate.values()) {
      const totalHours = daySchedules.reduce(
        (total, schedule) => total + Number(schedule.expected_hours || schedule.shift_template.duration_hours || 0),
        0,
      )
      if (totalHours > maxDailyHours) {
        daySchedules.forEach((schedule) => add(
          schedule,
          `單日工時 ${Math.round(totalHours * 10) / 10} 小時，超過 ${maxDailyHours} 小時`,
        ))
      }
      daySchedules.forEach((schedule, index) => {
        const current = shiftIntervalMinutes(schedule)
        daySchedules.slice(index + 1).forEach((nextSchedule) => {
          const next = shiftIntervalMinutes(nextSchedule)
          if (current.start < next.end && next.start < current.end) {
            add(schedule, `與 ${nextSchedule.shift_template.name} 時間重疊`)
            add(nextSchedule, `與 ${schedule.shift_template.name} 時間重疊`)
          }
        })
      })
    }
    return map
  }, [maxDailyHours, scheduleByEmployeeDate])

  const createVersion = useCreateScheduleVersion()
  const approveVersion = useApproveScheduleVersion()
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const checkCompliance = useCheckCompliance()
  const deriveLegal = useDeriveLegal()
  const updateVersion = useUpdateScheduleVersion()

  // ===== 拖曳狀態 =====
  type DragSource = {
    id: number
    employeeId: number
    date: string
    shiftTemplateId: number
    status: ScheduleStatus
    notes: string
    expectedHours: number
  }
  const [dragSource, setDragSource] = useState<DragSource | null>(null)
  const [dragOver, setDragOver] = useState<{ employeeId: number; date: string } | null>(null)
  type ContinuationIntent = {
    date: string
    employeeId?: number
    source?: DragSource
  }
  const [continuationIntent, setContinuationIntent] = useState<ContinuationIntent | null>(null)
  const [showContinuationDialog, setShowContinuationDialog] = useState(false)
  type PendingVersionAction = {
    versionId: number
    date: string
    employeeId?: number
    schedule?: Schedule
  }
  const [pendingVersionAction, setPendingVersionAction] = useState<PendingVersionAction | null>(null)

  const continuationDate = continuationIntent ? parseDate(continuationIntent.date) : null
  const coveringVersion = useMemo(() => {
    if (!continuationDate || !selectedVersion) return null
    const candidates = versions.filter((version) => (
      version.id !== selectedVersion.id
      && version.version_type === 'actual'
      && version.status !== 'archived'
      && version.organization === selectedVersion.organization
      && version.branch === selectedVersion.branch
      && isWithinPeriod(
        continuationDate,
        parseDate(version.period_start),
        parseDate(version.period_end),
      )
    ))
    const statusOrder: Record<ScheduleVersion['status'], number> = {
      draft: 0,
      published: 1,
      approved: 2,
      archived: 3,
    }
    return candidates.sort((a, b) => (
      statusOrder[a.status] - statusOrder[b.status]
      || b.created_at.localeCompare(a.created_at)
    ))[0] ?? null
  }, [continuationDate, selectedVersion, versions])

  const canExtendSelectedVersion = selectedVersion?.version_type === 'actual'
    && selectedVersion.status === 'draft'

  // ===== 工作流狀態 =====
  const [phase, setPhase] = useState<WorkflowPhase>('editing')
  const [complianceResult, setComplianceResult] = useState<CheckComplianceResult | null>(null)
  const [deriveLegalResult, setDeriveLegalResult] = useState<DeriveLegalResult | null>(null)

  const hardViolations = complianceResult?.violations.filter((v) => v.severity === 'hard') ?? []
  const softViolations = complianceResult?.violations.filter((v) => v.severity === 'soft') ?? []

  const violationMap = useMemo(() => {
    const map = new Map<string, ComplianceViolation>()
    if (phase !== 'violations' || !complianceResult) return map
    for (const v of complianceResult.violations) {
      map.set(violationCellKey(v), v)
    }
    return map
  }, [phase, complianceResult])

  const resetWorkflow = () => {
    setPhase('editing')
    setComplianceResult(null)
    setDeriveLegalResult(null)
  }

  useEffect(() => {
    resetWorkflow()
  }, [selectedVersion?.id])

  // ===== 合規檢查 =====
  const handleCheckCompliance = async () => {
    if (!selectedVersion) return
    setPhase('checking')
    try {
      const result = await checkCompliance.mutateAsync({ versionId: selectedVersion.id })
      setComplianceResult(result)

      const hards = result.violations.filter((v) => v.severity === 'hard')
      if (hards.length === 0) {
        // 合規 → 標為 A（legal）
        await updateVersion.mutateAsync({
          id: selectedVersion.id,
          data: { version_type: 'legal' },
        })
        toast({ title: '合規通過', description: `班表已標記為法規版 (A)。軟性提醒 ${result.violations.length} 筆。` })
        setPhase('done')
      } else {
        setPhase('violations')
      }
    } catch {
      setPhase('editing')
    }
  }

  // ===== 派生 A =====
  const handleDeriveLegal = async () => {
    if (!selectedVersion) return
    try {
      const result = await deriveLegal.mutateAsync({ bVersionId: selectedVersion.id })
      setDeriveLegalResult(result)
      toast({
        title: '法規版已產生',
        description: `新版本 #${result.legal_version_id}，${result.diff_summary.cells_removed_from_b} 格移除、${result.diff_summary.cells_added_in_a} 格新增`,
      })
      setPhase('done')
      // 切換到新 A 版本
      await refetchVersions()
      setVersionId(String(result.legal_version_id))
    } catch {
      // Error handled by the mutation
    }
  }

  // ===== 維持 B =====
  const handleKeepAsB = async () => {
    if (!selectedVersion) return
    await updateVersion.mutateAsync({
      id: selectedVersion.id,
      data: { version_type: 'actual' },
    })
    toast({ title: '已標記為 B 班表', description: '此版本維持為實際版 (B)' })
    setPhase('done')
  }

  // ===== 拖曳 Drop 處理 =====
  const performDrop = async (src: DragSource, targetEmployeeId: number, targetDate: string) => {
    if (!selectedVersion) return
    if (src.employeeId === targetEmployeeId && src.date === targetDate) return

    const srcBase = {
      shift_template: src.shiftTemplateId,
      status: src.status,
      notes: src.notes,
      expected_hours: src.expectedHours,
    }

    try {
      const targetSchedules = scheduleByEmployeeDate.get(`${targetEmployeeId}:${targetDate}`) ?? []
      if (targetSchedules.some((schedule) => schedule.shift_template.id === src.shiftTemplateId)) {
        toast({
          title: '無法合併相同班別',
          description: '同一員工、日期與班別不可重複。',
          variant: 'destructive',
        })
        return
      }

      await schedulesApi.update(src.id, {
        ...srcBase,
        employee: targetEmployeeId,
        schedule_date: targetDate,
      })
      if (selectedVersion.version_type === 'legal') {
        await scheduleVersionsApi.update(selectedVersion.id, { version_type: 'actual' })
        await refetchVersions()
      }
      toast({
        title: targetSchedules.length ? '班次合併成功' : '移動成功',
        description: targetSchedules.length
          ? '班次已加入目標日期；如有重疊或超時會顯示警告。'
          : '班表已移動',
      })
      resetWorkflow()
      await refetchSchedules()
    } catch {
      await refetchSchedules()
    }
  }

  const handleDrop = async (targetEmployeeId: number, targetDate: string) => {
    if (!dragSource || !selectedVersion) return
    const src = dragSource
    setDragSource(null)
    setDragOver(null)

    if (!isWithinPeriod(parseDate(targetDate), periodStart, periodEnd)) {
      setContinuationIntent({ date: targetDate, employeeId: targetEmployeeId, source: src })
      setShowContinuationDialog(true)
      return
    }
    await performDrop(src, targetEmployeeId, targetDate)
  }

  const handleTimelineDrop = async (
    ownerVersion: ScheduleVersion | null,
    hasConflict: boolean,
    targetEmployeeId: number,
    targetDate: string,
  ) => {
    if (hasConflict) {
      setDragSource(null)
      setDragOver(null)
      toast({
        title: '版本期間衝突',
        description: '此日期同時屬於多個版本，請先整理版本期間後再排班。',
        variant: 'destructive',
      })
      return
    }
    if (ownerVersion && ownerVersion.id !== selectedVersion?.id) {
      setDragSource(null)
      setDragOver(null)
      toast({
        title: '不可跨版本拖曳',
        description: `此日期屬於「${ownerVersion.version_label}」。請先切換版本後再移動班次。`,
        variant: 'destructive',
      })
      return
    }
    await handleDrop(targetEmployeeId, targetDate)
  }

  // ===== 建立版本對話框 =====
  const [showVersionDialog, setShowVersionDialog] = useState(false)
  const [versionForm, setVersionForm] = useState({
    organization: '',
    branch: '',
    version_label: '',
    period_start: '',
    period_end: '',
  })
  type PeriodPreset = 'same-length' | 'month' | 'four-weeks' | 'custom'
  const [versionPreset, setVersionPreset] = useState<PeriodPreset>('same-length')
  const [versionLabelAuto, setVersionLabelAuto] = useState(true)

  const setVersionPeriod = (start: Date, end: Date, preset: PeriodPreset) => {
    setVersionPreset(preset)
    setVersionForm((current) => ({
      ...current,
      period_start: fmtDate(start),
      period_end: fmtDate(end),
      version_label: versionLabelAuto || !current.version_label
        ? buildVersionLabel(start, end)
        : current.version_label,
    }))
  }

  const openVersionDialog = (start: Date, end: Date, preset: PeriodPreset) => {
    if (!orgIdResolved) {
      toast({ title: '請先指定機構', description: '排班管理必須指定機構後才能建立版本', variant: 'destructive' })
      return
    }
    setVersionPreset(preset)
    setVersionLabelAuto(true)
    setVersionForm({
      organization: String(orgIdResolved),
      branch: selectedVersion?.branch
        ? String(selectedVersion.branch)
        : branchId !== 'all' ? branchId : '',
      version_label: buildVersionLabel(start, end),
      period_start: fmtDate(start),
      period_end: fmtDate(end),
    })
    setShowVersionDialog(true)
  }

  const openCreateVersion = () => {
    if (selectedVersion) {
      const currentStart = parseDate(selectedVersion.period_start)
      const currentEnd = parseDate(selectedVersion.period_end)
      const nextStart = addDays(currentEnd, 1)
      openVersionDialog(
        nextStart,
        addDays(nextStart, inclusiveDays(currentStart, currentEnd) - 1),
        'same-length',
      )
    } else {
      const monthStart = startOfMonth(weekStart)
      openVersionDialog(monthStart, endOfMonth(monthStart), 'month')
    }
  }

  const openCreateAdjacentVersion = (targetDate: Date) => {
    if (!selectedVersion) return
    const currentStart = parseDate(selectedVersion.period_start)
    const currentEnd = parseDate(selectedVersion.period_end)
    const duration = inclusiveDays(currentStart, currentEnd)
    const isBefore = targetDate < currentStart
    let start = isBefore ? addDays(currentStart, -duration) : addDays(currentEnd, 1)
    let end = addDays(start, duration - 1)
    if (targetDate < start || targetDate > end) {
      start = startOfMonth(targetDate)
      end = addDays(start, duration - 1)
    }
    openVersionDialog(start, end, 'same-length')
    setShowContinuationDialog(false)
  }

  const applyPeriodPreset = (preset: PeriodPreset) => {
    setVersionPreset(preset)
    if (preset === 'custom') return
    const start = versionForm.period_start
      ? parseDate(versionForm.period_start)
      : startOfMonth(weekStart)
    if (preset === 'month') {
      setVersionPeriod(start, endOfMonth(start), preset)
      return
    }
    if (preset === 'four-weeks') {
      setVersionPeriod(start, addDays(start, 27), preset)
      return
    }
    const duration = selectedVersion
      ? inclusiveDays(parseDate(selectedVersion.period_start), parseDate(selectedVersion.period_end))
      : 28
    setVersionPeriod(start, addDays(start, duration - 1), preset)
  }

  const updateVersionDate = (field: 'period_start' | 'period_end', value: string) => {
    setVersionPreset('custom')
    setVersionForm((current) => {
      const next = { ...current, [field]: value }
      if (versionLabelAuto && next.period_start && next.period_end) {
        next.version_label = buildVersionLabel(
          parseDate(next.period_start),
          parseDate(next.period_end),
        )
      }
      return next
    })
  }

  const submitCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!versionForm.organization) {
      toast({ title: '請先選擇機構', variant: 'destructive' })
      return
    }
    if (!versionForm.version_label.trim()) {
      toast({ title: '請輸入版本標籤', variant: 'destructive' })
      return
    }
    if (!versionForm.period_start || !versionForm.period_end) {
      toast({ title: '請選擇期間', variant: 'destructive' })
      return
    }
    if (parseDate(versionForm.period_start) > parseDate(versionForm.period_end)) {
      toast({ title: '期間設定錯誤', description: '開始日期不可晚於結束日期', variant: 'destructive' })
      return
    }

    const payload: ScheduleVersionCreateRequest = {
      organization: Number(versionForm.organization),
      branch: versionForm.branch ? Number(versionForm.branch) : null,
      version_label: versionForm.version_label.trim(),
      version_type: 'actual',
      period_start: versionForm.period_start,
      period_end: versionForm.period_end,
    }

    const created = await createVersion.mutateAsync(payload)
    setShowVersionDialog(false)
    setVersionId(String(created.id))
  }

  // ===== 排班 CRUD 對話框 =====
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [scheduleForm, setScheduleForm] = useState({
    employee: '',
    schedule_date: '',
    shift_template: '',
    status: 'assigned' as ScheduleStatus,
    notes: '',
  })

  const openCreateScheduleAt = (employeeId: number, d: Date) => {
    if (!selectedVersion) return
    setEditingSchedule(null)
    setScheduleForm({
      employee: String(employeeId),
      schedule_date: fmtDate(d),
      shift_template: '',
      status: 'assigned',
      notes: '',
    })
    setShowScheduleDialog(true)
  }

  const requestPeriodContinuation = (
    date: Date,
    employeeId?: number,
    source?: DragSource,
  ) => {
    setContinuationIntent({ date: fmtDate(date), employeeId, source })
    setShowContinuationDialog(true)
  }

  const switchToCoveringVersion = () => {
    if (!coveringVersion || !continuationIntent) return
    setVersionNavigationDate(continuationIntent.date)
    setVersionId(String(coveringVersion.id))
    setShowContinuationDialog(false)
    toast({
      title: `已切換至 ${coveringVersion.version_label}`,
      description: `目前版本期間為 ${coveringVersion.period_start} ～ ${coveringVersion.period_end}`,
    })
  }

  const extendSelectedVersion = async () => {
    if (!selectedVersion || !continuationDate || !continuationIntent || !canExtendSelectedVersion) return
    const currentStart = parseDate(selectedVersion.period_start)
    const currentEnd = parseDate(selectedVersion.period_end)
    const newStart = continuationDate < currentStart ? startOfMonth(continuationDate) : currentStart
    const newEnd = continuationDate > currentEnd ? endOfMonth(continuationDate) : currentEnd
    await updateVersion.mutateAsync({
      id: selectedVersion.id,
      data: {
        period_start: fmtDate(newStart),
        period_end: fmtDate(newEnd),
      },
    })
    await refetchVersions()
    setShowContinuationDialog(false)
    toast({
      title: '版本期間已延長',
      description: `${fmtDate(newStart)} ～ ${fmtDate(newEnd)}`,
    })
    if (continuationIntent.source && continuationIntent.employeeId) {
      await performDrop(
        continuationIntent.source,
        continuationIntent.employeeId,
        continuationIntent.date,
      )
    } else if (continuationIntent.employeeId) {
      openCreateScheduleAt(continuationIntent.employeeId, continuationDate)
    }
  }

  const openEditSchedule = (s: Schedule) => {
    setEditingSchedule(s)
    setScheduleForm({
      employee: String(s.employee.id),
      schedule_date: s.schedule_date,
      shift_template: String(s.shift_template.id),
      status: s.status,
      notes: s.notes || '',
    })
    setShowScheduleDialog(true)
  }

  const switchVersionForAction = (
    version: ScheduleVersion,
    date: string,
    action?: Omit<PendingVersionAction, 'versionId' | 'date'>,
  ) => {
    setVersionNavigationDate(date)
    setPendingVersionAction(action ? { versionId: version.id, date, ...action } : null)
    setVersionId(String(version.id))
    toast({
      title: `已切換至 ${version.version_label}`,
      description: action ? '已依目標日期開啟對應版本。' : undefined,
    })
  }

  useEffect(() => {
    if (!pendingVersionAction || selectedVersion?.id !== pendingVersionAction.versionId) return
    if (pendingVersionAction.schedule) {
      openEditSchedule(pendingVersionAction.schedule)
    } else if (pendingVersionAction.employeeId) {
      openCreateScheduleAt(
        pendingVersionAction.employeeId,
        parseDate(pendingVersionAction.date),
      )
    }
    setPendingVersionAction(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVersionAction, selectedVersion?.id])

  const submitSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVersion) return
    if (!scheduleForm.employee || !scheduleForm.schedule_date || !scheduleForm.shift_template) {
      toast({ title: '資料不完整', description: '請選擇員工、日期與班別', variant: 'destructive' })
      return
    }
    if (!isWithinPeriod(
      parseDate(scheduleForm.schedule_date),
      parseDate(selectedVersion.period_start),
      parseDate(selectedVersion.period_end),
    )) {
      toast({
        title: '日期不在目前版本期間',
        description: `請選擇 ${selectedVersion.period_start} ～ ${selectedVersion.period_end} 內的日期，或先延長／建立其他版本。`,
        variant: 'destructive',
      })
      return
    }
    const tpl = templates.find((t) => String(t.id) === scheduleForm.shift_template)
    const payloadBase: ScheduleCreateRequest = {
      schedule_version: selectedVersion.id,
      employee: Number(scheduleForm.employee),
      shift_template: Number(scheduleForm.shift_template),
      schedule_date: scheduleForm.schedule_date,
      status: scheduleForm.status,
      notes: scheduleForm.notes?.trim() || '',
      expected_hours: tpl ? Number(tpl.duration_hours) : 0,
    }

    if (editingSchedule) {
      await updateSchedule.mutateAsync({ id: editingSchedule.id, data: payloadBase })
    } else {
      await createSchedule.mutateAsync(payloadBase)
    }
    setShowScheduleDialog(false)
    resetWorkflow()
  }

  // ===== 版本比較 =====
  type CompareResult = {
    version1: unknown
    version2: unknown
    only_in_version1: string[]
    only_in_version2: string[]
    differences: Array<{ key: string; version1: unknown; version2: unknown }>
  }

  const [showCompareDialog, setShowCompareDialog] = useState(false)
  const [compareVersion2Id, setCompareVersion2Id] = useState<string>('none')
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)

  const openCompare = () => {
    if (!selectedVersion) return
    setCompareVersion2Id('none')
    setCompareResult(null)
    setShowCompareDialog(true)
  }

  const runCompare = async () => {
    if (!selectedVersion || compareVersion2Id === 'none') return
    try {
      setCompareLoading(true)
      const data = (await scheduleVersionsApi.compare(selectedVersion.id, Number(compareVersion2Id))) as CompareResult
      setCompareResult(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '無法比較版本差異'
      toast({ title: '比較失敗', description: msg, variant: 'destructive' })
    } finally {
      setCompareLoading(false)
    }
  }

  // ===== 匯出 Excel =====
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportDateFrom, setExportDateFrom] = useState('')
  const [exportDateTo, setExportDateTo] = useState('')
  const [exportLayout, setExportLayout] = useState<ScheduleExportLayout>('personal')
  const [exportLoading, setExportLoading] = useState(false)

  const openExport = () => {
    if (!selectedVersion) return
    setExportDateFrom(selectedVersion.period_start)
    setExportDateTo(selectedVersion.period_end)
    setShowExportDialog(true)
  }

  const runExport = async () => {
    if (!selectedVersion) return
    if (!exportDateFrom || !exportDateTo || exportDateFrom > exportDateTo) {
      toast({ title: '匯出失敗', description: '請確認起訖日期正確', variant: 'destructive' })
      return
    }
    try {
      setExportLoading(true)
      const [scheduleResponse, employeeResponse] = await Promise.all([
        schedulesApi.listAll({
          version: selectedVersion.id,
          date_from: exportDateFrom,
          date_to: exportDateTo,
        }),
        exportLayout === 'integrated'
          ? employeesApi.listAll({
              is_active: true,
              organization: selectedVersion.organization,
              branch: branchId === 'all'
                ? (selectedVersion.branch ?? undefined)
                : Number(branchId),
            })
          : Promise.resolve(null),
      ])

      const versionLabel = `${selectedVersion.version_label}（${selectedVersion.version_type === 'legal' ? 'A 法規版' : 'B 實際版'}）`
      const { createScheduleWorkbook } = await import('@/lib/scheduleExcelExport')
      const buffer = await createScheduleWorkbook({
        schedules: scheduleResponse.results,
        employees: employeeResponse?.results,
        dateFrom: exportDateFrom,
        dateTo: exportDateTo,
        versionLabel,
        layout: exportLayout,
      })
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const layoutLabel = exportLayout === 'personal' ? '個人版表' : '整合班表'
      a.download = `${selectedVersion.version_label}_${layoutLabel}_${exportDateFrom}_${exportDateTo}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setShowExportDialog(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '無法匯出班表'
      toast({ title: '匯出失敗', description: msg, variant: 'destructive' })
    } finally {
      setExportLoading(false)
    }
  }

  // ===== 週導航 =====
  const prevWeek = () => {
    setWeekStart(addDays(weekStart, -7))
  }
  const nextWeek = () => {
    setWeekStart(addDays(weekStart, 7))
  }

  const isBusy = schedulesLoading
    || adjacentScheduleQueries.some((query) => query.isLoading)
    || employeesLoading
    || versionsLoading

  const versionBadgeLabel = selectedVersion
    ? selectedVersion.version_type === 'legal'
      ? 'A 法規版'
      : 'B 實際版'
    : null

  const versionBadgeVariant = selectedVersion?.version_type === 'legal' ? 'default' : 'secondary'

  return (
    <div className="space-y-6">
      {/* ===== 頁面標題 ===== */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">排班管理</h1>
          <p className="text-muted-foreground mt-1">建立班表 → 合規檢查 → 標記 A / B 班表</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { refetchVersions(); refetchSchedules(); resetWorkflow() }} disabled={isBusy}>
            <RefreshCw className="h-4 w-4 mr-2" />
            重新整理
          </Button>
          <Button onClick={openCreateVersion}>
            <Plus className="h-4 w-4 mr-2" />
            新增排班版本
          </Button>
        </div>
      </div>

      {/* ===== 篩選與版本 ===== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            篩選與版本
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>機構（必選）</Label>
            <Select
              value={orgId}
              onValueChange={(v) => {
                setOrgId(v)
                setBranchId('all')
                setVersionId('none')
              }}
              disabled={organizations.length === 0}
            >
              <SelectTrigger><SelectValue placeholder="選擇機構" /></SelectTrigger>
              <SelectContent>
                {organizations.length === 0 ? (
                  <SelectItem value="__empty__" disabled>沒有可用機構</SelectItem>
                ) : (
                  organizations.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
            {!orgIdResolved && <p className="text-xs text-destructive mt-1">請先指定機構</p>}
          </div>
          <div className="space-y-1.5">
            <Label>分店</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue placeholder="選擇分店" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>排班版本</Label>
            <Select value={versionId} onValueChange={(v) => { setVersionId(v); resetWorkflow() }} disabled={!orgIdResolved}>
              <SelectTrigger><SelectValue placeholder="選擇排班版本" /></SelectTrigger>
              <SelectContent>
                {versions.length === 0 ? (
                  <SelectItem value="none" disabled>尚無版本</SelectItem>
                ) : (
                  versions.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.version_label}（{v.version_type === 'legal' ? 'A' : 'B'}｜{v.status_display}）
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedVersion && (
              <p className="text-xs text-muted-foreground mt-1">
                期間：{selectedVersion.period_start} ~ {selectedVersion.period_end}，共 {selectedVersion.schedule_count} 筆
                {selectedVersion.derived_from ? ` · 派生自 #${selectedVersion.derived_from}` : ''}
              </p>
            )}
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* 合規檢查按鈕 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckCompliance}
              disabled={!selectedVersion || checkCompliance.isPending || phase === 'checking'}
            >
              {checkCompliance.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              合規檢查
            </Button>
            {/* 簽核 */}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => { if (selectedVersion) await approveVersion.mutateAsync(selectedVersion.id) }}
              disabled={!selectedVersion || selectedVersion.status !== 'draft' || approveVersion.isPending}
            >
              {approveVersion.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              簽核版本
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams()
                if (orgIdResolved) params.set('organization', String(orgIdResolved))
                if (branchId !== 'all') params.set('branch', branchId)
                params.set('track', selectedVersion?.version_type ?? 'actual')
                navigate(`/schedules/approved?${params.toString()}`)
              }}
            >
              <FileCheck2 className="mr-2 h-4 w-4" />
              簽核總表
            </Button>
            {/* Compare */}
            <Button variant="outline" size="sm" onClick={openCompare} disabled={!selectedVersion}>
              Compare 差異
            </Button>
            {/* 匯出 */}
            <Button variant="outline" size="sm" onClick={openExport} disabled={!selectedVersion}>
              <Download className="h-4 w-4 mr-2" />
              匯出
            </Button>

            {selectedVersion && (
              <Badge variant={versionBadgeVariant} className="ml-auto">
                {versionBadgeLabel}｜{selectedVersion.status_display}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== 合規結果條 ===== */}
      {phase === 'done' && complianceResult && hardViolations.length === 0 && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="py-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-800">合規通過 — 已標記為 A 班表（法規版）</p>
              {softViolations.length > 0 && (
                <p className="text-sm text-emerald-700 mt-0.5">{softViolations.length} 筆軟性提醒（不影響合規判定）</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {phase === 'done' && deriveLegalResult && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="py-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-800">
                法規版 (A) 已產生 — 版本 #{deriveLegalResult.legal_version_id}
              </p>
              <p className="text-sm text-emerald-700 mt-0.5">
                {deriveLegalResult.diff_summary.cells_unchanged} 格不變、{deriveLegalResult.diff_summary.cells_removed_from_b} 格移除、{deriveLegalResult.diff_summary.cells_added_in_a} 格新增
                {deriveLegalResult.billing ? ` · 扣除 ${deriveLegalResult.billing.tokens_charged} token` : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== 違規面板（3-2 不合規情形） ===== */}
      {phase === 'violations' && complianceResult && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              不合規 — {hardViolations.length} 筆硬性違規{softViolations.length > 0 ? `、${softViolations.length} 筆軟性提醒` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 違規摘要 */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(complianceResult.summary_by_rule).map(([rule, count]) => (
                <Badge key={rule} variant="outline" className="border-destructive/30 text-destructive">
                  {rule} × {count}
                </Badge>
              ))}
            </div>
            {/* 違規明細（最多顯示 10 筆） */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {complianceResult.violations.slice(0, 10).map((v, i) => (
                <div key={i} className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-2 text-sm',
                  v.severity === 'hard' ? 'border-destructive/30 bg-destructive/5' : 'border-amber-200 bg-amber-50/50',
                )}>
                  <AlertTriangle className={cn('h-4 w-4 mt-0.5 shrink-0', v.severity === 'hard' ? 'text-destructive' : 'text-amber-600')} />
                  <div>
                    <span className="font-medium">{v.employee_name}</span>
                    <span className="text-muted-foreground"> · {v.schedule_date}</span>
                    <span className="text-muted-foreground"> · {v.rule_label}</span>
                    {v.detail && Object.keys(v.detail).length > 0 && (
                      <span className="text-muted-foreground text-xs ml-2">
                        ({Object.entries(v.detail).map(([k, val]) => `${k}: ${val}`).join(', ')})
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className={cn(
                    'ml-auto shrink-0',
                    v.severity === 'hard' ? 'border-destructive/30 text-destructive' : 'border-amber-300 text-amber-700',
                  )}>
                    {v.severity === 'hard' ? '違規' : '提醒'}
                  </Badge>
                </div>
              ))}
              {complianceResult.violations.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  …另有 {complianceResult.violations.length - 10} 筆
                </p>
              )}
            </div>
            {/* 底部操作按鈕 */}
            <div className="flex items-center gap-3 pt-2 border-t">
              <Button onClick={handleDeriveLegal} disabled={deriveLegal.isPending}>
                {deriveLegal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                系統修正為法規版 (A)
              </Button>
              <Button variant="outline" onClick={handleKeepAsB} disabled={updateVersion.isPending}>
                {updateVersion.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                維持現版 (B)
              </Button>
              <Button variant="ghost" size="sm" onClick={resetWorkflow} className="ml-auto">
                返回編輯
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== 週排班表 Grid ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>週排班表</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prevWeek} aria-label="上一週">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium">{dateFrom} ~ {dateTo}</div>
              <Button variant="outline" size="sm" onClick={nextWeek} aria-label="下一週">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedVersion && visibleOwnerVersions.length > 1 && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
              <div>
                <div className="text-sm font-medium text-blue-900">
                  本週班表由 {visibleOwnerVersions.length} 個連續版本拼接顯示
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {visibleOwnerVersions.map((version) => {
                    const ownedDates = weekDays
                      .filter((day) => versionResolutionByDate.get(fmtDate(day))?.version?.id === version.id)
                      .map(fmtDate)
                    return (
                      <Badge key={version.id} variant="outline" className="border-blue-200 bg-background text-blue-800">
                        {version.version_label}：{ownedDates[0]?.slice(5)}～{ownedDates[ownedDates.length - 1]?.slice(5)}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          {selectedVersion && conflictWeekDays.length > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="text-sm font-medium">本週存在重疊的排班版本</div>
                <div className="mt-0.5 text-xs opacity-80">
                  衝突日期：{conflictWeekDays.map((day) => fmtDate(day)).join('、')}。衝突日期暫停編輯，請先整理版本期間。
                </div>
              </div>
            </div>
          )}
          {selectedVersion && uncoveredWeekDays.length > 0 && (
            <div className="mb-3 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  <div className="text-sm font-medium text-amber-900">本週有日期尚無排班版本</div>
                  <div className="mt-0.5 text-xs text-amber-800/80">
                    未涵蓋日期：{uncoveredWeekDays.map((day) => fmtDate(day)).join('、')}。建立或延長版本後才能排班。
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-300 bg-background text-amber-900 hover:bg-amber-100"
                onClick={() => requestPeriodContinuation(uncoveredWeekDays[0])}
              >
                處理版本期間
              </Button>
            </div>
          )}
          {!orgIdResolved ? (
            <div className="py-16 text-center text-muted-foreground">請先指定機構</div>
          ) : !selectedVersion ? (
            <div className="py-16 text-center text-muted-foreground">請先選擇或建立排班版本</div>
          ) : isBusy ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : employees.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">沒有可排班的在職員工</div>
          ) : (
            <div className="overflow-auto rounded-lg border">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="sticky top-0 bg-background/95 backdrop-blur border-b">
                  <tr>
                    <th className="text-left p-3 w-56">員工</th>
                    {weekDays.map((d, idx) => {
                      const date = fmtDate(d)
                      const resolution = versionResolutionByDate.get(date)
                      const ownerVersion = resolution?.version
                      const previousOwner = idx > 0
                        ? versionResolutionByDate.get(fmtDate(weekDays[idx - 1]))?.version
                        : null
                      const isVersionBoundary = idx > 0 && ownerVersion?.id !== previousOwner?.id
                      const hasConflict = (resolution?.conflicts.length ?? 0) > 1
                      return (
                      <th
                        key={idx}
                        className={cn(
                          'min-w-32 p-3 text-left',
                          !ownerVersion && 'bg-muted/50 text-muted-foreground',
                          isVersionBoundary && 'border-l-2 border-l-primary/50',
                          hasConflict && 'bg-destructive/5',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">週{weekdayLabels[idx]}</span>
                          <span className="text-xs text-muted-foreground">{date.slice(5)}</span>
                        </div>
                        <div className={cn(
                          'mt-1 truncate text-[10px] font-normal',
                          ownerVersion ? 'text-primary/75' : 'text-muted-foreground/70',
                        )}>
                          {hasConflict ? '版本衝突' : ownerVersion?.version_label ?? '尚無版本'}
                        </div>
                      </th>
                    )})}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="relative p-3 pr-10 align-top">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                            {(e.user_name || e.user.first_name || e.user.username).slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{e.user_name || `${e.user.first_name} ${e.user.last_name}`.trim() || e.user.username}</div>
                            <div className="text-[11px] text-muted-foreground">{e.employee_id} · {e.position}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          onClick={(event) => openEmployeeMonthSchedule(e, event.currentTarget)}
                          title={`查看${e.user_name || e.user.first_name || e.user.username}的月班表`}
                          aria-label={`查看${e.user_name || e.user.first_name || e.user.username}的月班表`}
                        >
                          <CalendarDays className="h-4 w-4" />
                        </button>
                      </td>
                      {weekDays.map((d, dayIndex) => {
                        const date = fmtDate(d)
                        const key = `${e.id}:${date}`
                        const cellSchedules = scheduleByEmployeeDate.get(key) ?? []
                        const isDragTarget = dragOver?.employeeId === e.id && dragOver?.date === date
                        const resolution = versionResolutionByDate.get(date)
                        const ownerVersion = resolution?.version ?? null
                        const hasConflict = (resolution?.conflicts.length ?? 0) > 1
                        const isSelectedOwner = ownerVersion?.id === selectedVersion?.id
                        const previousOwner = dayIndex > 0
                          ? versionResolutionByDate.get(fmtDate(weekDays[dayIndex - 1]))?.version
                          : null
                        const isVersionBoundary = dayIndex > 0 && ownerVersion?.id !== previousOwner?.id

                        return (
                          <td
                            key={date}
                            className={cn(
                              'p-1.5 align-top transition-colors',
                              !ownerVersion && 'bg-muted/35',
                              ownerVersion && !isSelectedOwner && 'bg-blue-50/20',
                              isVersionBoundary && 'border-l-2 border-l-primary/50',
                              hasConflict && 'bg-destructive/5',
                              isDragTarget && 'bg-primary/10 outline outline-2 outline-primary/40 rounded-md',
                            )}
                            onDragOver={(ev) => { ev.preventDefault(); setDragOver({ employeeId: e.id, date }) }}
                            onDragLeave={(ev) => {
                              if (!ev.currentTarget.contains(ev.relatedTarget as Node)) setDragOver(null)
                            }}
                            onDrop={(ev) => {
                              ev.preventDefault()
                              handleTimelineDrop(ownerVersion, hasConflict, e.id, date)
                            }}
                          >
                            {cellSchedules.length ? (
                              <div className="space-y-1">
                                {cellSchedules.map((schedule) => {
                                  const templateIndex = templates.findIndex((t) => t.id === schedule.shift_template.id)
                                  const chip = shiftChipColors[(templateIndex >= 0 ? templateIndex : 0) % shiftChipColors.length]
                                  const violation = violationMap.get(`${e.id}:${date}:${schedule.shift_template.id}`)
                                  const warnings = immediateWarningMap.get(schedule.id) ?? []
                                  const isHard = violation?.severity === 'hard' || warnings.length > 0
                                  const isSoft = violation?.severity === 'soft' && warnings.length === 0
                                  const title = [
                                    ...(!isSelectedOwner && ownerVersion
                                      ? [`來自版本：${ownerVersion.version_label}`]
                                      : []),
                                    ...warnings,
                                    ...(violation ? [`${violation.rule_label}：${JSON.stringify(violation.detail)}`] : []),
                                  ].join('\n')
                                  return (
                                    <div
                                      key={schedule.id}
                                      draggable={isSelectedOwner && !hasConflict}
                                      onDragStart={() => {
                                        if (!isSelectedOwner || hasConflict) return
                                        setDragSource({
                                          id: schedule.id,
                                          employeeId: e.id,
                                          date,
                                          shiftTemplateId: schedule.shift_template.id,
                                          status: schedule.status,
                                          notes: schedule.notes || '',
                                          expectedHours: Number(schedule.expected_hours || schedule.shift_template.duration_hours || 0),
                                        })
                                      }}
                                      onDragEnd={() => { setDragSource(null); setDragOver(null) }}
                                      className={cn(
                                        isSelectedOwner && !hasConflict
                                          ? 'cursor-grab active:cursor-grabbing'
                                          : 'cursor-pointer',
                                        dragSource?.id === schedule.id && 'opacity-40',
                                      )}
                                    >
                                      <button
                                        type="button"
                                        className={cn(
                                          'relative w-full rounded-md border px-2 py-2 text-left transition hover:shadow-sm',
                                          isHard
                                            ? 'border-destructive bg-destructive/10 ring-1 ring-destructive/30'
                                            : isSoft
                                              ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300/40'
                                              : `${chip.bg} ${chip.border}`,
                                        )}
                                        onClick={() => {
                                          if (hasConflict) {
                                            toast({
                                              title: '版本期間衝突',
                                              description: '請先整理重疊版本後再編輯此日期。',
                                              variant: 'destructive',
                                            })
                                          } else if (ownerVersion && !isSelectedOwner) {
                                            switchVersionForAction(ownerVersion, date, { schedule })
                                          } else {
                                            openEditSchedule(schedule)
                                          }
                                        }}
                                        title={title || undefined}
                                      >
                                        <div className="pr-3">
                                          <div className={cn('truncate text-xs font-semibold', isHard ? 'text-destructive' : isSoft ? 'text-amber-700' : chip.text)}>
                                            {schedule.shift_template.name}
                                          </div>
                                          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                                            {schedule.shift_template.start_time.slice(0, 5)}-{schedule.shift_template.end_time.slice(0, 5)}
                                          </div>
                                        </div>
                                        {(isHard || isSoft) && (
                                          <AlertTriangle className={cn(
                                            'absolute bottom-1.5 right-1.5 h-3 w-3',
                                            isHard ? 'text-destructive' : 'text-amber-600',
                                          )} />
                                        )}
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <button
                                type="button"
                                className={cn(
                                  'w-full rounded-md border border-dashed px-2 py-5 text-muted-foreground hover:bg-muted/40 hover:border-primary/40 transition text-xs',
                                  !ownerVersion && 'border-muted-foreground/25 bg-muted/20 hover:border-amber-400 hover:bg-amber-50',
                                  ownerVersion && !isSelectedOwner && 'border-blue-200 bg-blue-50/30 hover:border-blue-400 hover:bg-blue-50',
                                  hasConflict && 'border-destructive/40 bg-destructive/5 text-destructive',
                                  isDragTarget && 'border-primary border-solid bg-primary/5',
                                )}
                                onClick={() => {
                                  if (hasConflict) {
                                    toast({
                                      title: '版本期間衝突',
                                      description: '請先整理重疊版本後再指派班次。',
                                      variant: 'destructive',
                                    })
                                  } else if (!ownerVersion) {
                                    requestPeriodContinuation(d, e.id)
                                  } else if (!isSelectedOwner) {
                                    switchVersionForAction(ownerVersion, date, { employeeId: e.id })
                                  } else {
                                    openCreateScheduleAt(e.id, d)
                                  }
                                }}
                              >
                                {isDragTarget
                                  ? <span className={cn(
                                      'font-medium',
                                      hasConflict || (ownerVersion && !isSelectedOwner)
                                        ? 'text-destructive'
                                        : 'text-primary',
                                    )}>
                                      {hasConflict || (ownerVersion && !isSelectedOwner) ? '不可跨版本' : '放置於此'}
                                    </span>
                                  : hasConflict
                                    ? <><AlertTriangle className="mr-1 inline h-3 w-3" />版本衝突</>
                                    : !ownerVersion
                                      ? <><CalendarDays className="mr-1 inline h-3 w-3" />尚無版本</>
                                    : <><Plus className="h-3 w-3 inline mr-0.5" />指派</>
                                }
                              </button>
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
          {templates.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {templates.map((t, i) => {
                const c = shiftChipColors[i % shiftChipColors.length]
                return (
                  <div key={t.id} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                    {t.name}
                  </div>
                )
              })}
              <span className="mx-1">·</span>
              <div className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-600" />已確認</div>
              <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-muted-foreground" />已指派</div>
              {phase === 'violations' && (
                <>
                  <div className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-destructive" />硬性違規</div>
                  <div className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 text-amber-600" />軟性提醒</div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {monthScheduleEmployee && selectedVersion && (
        <EmployeeMonthScheduleDialog
          open={monthScheduleOpen}
          onOpenChange={setMonthScheduleOpen}
          employee={monthScheduleEmployee}
          versionId={selectedVersion.id}
          versionLabel={`${selectedVersion.version_label}（${selectedVersion.version_type === 'legal' ? 'A 法規版' : 'B 實際版'}）`}
          periodStart={selectedVersion.period_start}
          periodEnd={selectedVersion.period_end}
          initialMonth={weekDays[3]}
          origin={monthDialogOrigin}
          templates={templates}
          violations={complianceResult?.violations ?? []}
          versions={versions}
        />
      )}

      {/* ===== 版本期間外操作 Dialog ===== */}
      <Dialog open={showContinuationDialog} onOpenChange={setShowContinuationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>此日期不在目前版本期間</DialogTitle>
            <DialogDescription>
              {selectedVersion && continuationIntent
                ? `目標日期 ${continuationIntent.date}；「${selectedVersion.version_label}」僅涵蓋 ${selectedVersion.period_start} ～ ${selectedVersion.period_end}。`
                : '請選擇如何繼續。'}
            </DialogDescription>
          </DialogHeader>

          {coveringVersion ? (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm font-medium">已有班表涵蓋這個日期</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {coveringVersion.version_label} · {coveringVersion.period_start} ～ {coveringVersion.period_end}
              </div>
              <Button className="mt-4 w-full" type="button" onClick={switchToCoveringVersion}>
                切換到這個版本
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {canExtendSelectedVersion && continuationDate && selectedVersion && (
                <div className="rounded-lg border p-4">
                  <div className="text-sm font-medium">延長目前 B 草稿</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    期間將延長為{' '}
                    {continuationDate < parseDate(selectedVersion.period_start)
                      ? fmtDate(startOfMonth(continuationDate))
                      : selectedVersion.period_start}
                    {' '}～{' '}
                    {continuationDate > parseDate(selectedVersion.period_end)
                      ? fmtDate(endOfMonth(continuationDate))
                      : selectedVersion.period_end}
                  </div>
                  <Button
                    className="mt-4 w-full"
                    type="button"
                    variant="outline"
                    disabled={updateVersion.isPending}
                    onClick={extendSelectedVersion}
                  >
                    {updateVersion.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    延長目前版本
                  </Button>
                </div>
              )}

              {continuationDate && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="text-sm font-medium">
                    建立{selectedVersion && continuationDate < parseDate(selectedVersion.period_start) ? '上一期' : '下一期'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    預設沿用目前版本長度，日期與版本標籤會自動填入，仍可在下一步調整。
                  </div>
                  <Button
                    className="mt-4 w-full"
                    type="button"
                    onClick={() => openCreateAdjacentVersion(continuationDate)}
                  >
                    建立新版本
                  </Button>
                </div>
              )}
            </div>
          )}

          {continuationIntent?.source && (
            <p className="text-xs text-muted-foreground">
              若選擇切換或建立其他版本，原班次不會跨版本移動；只有延長目前草稿時會接續完成本次拖曳。
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowContinuationDialog(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 新增版本 Dialog ===== */}
      <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增排班版本</DialogTitle>
            <DialogDescription>建立新排班版本（預設為實際版 B，合規後可升為法規版 A）</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreateVersion} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>機構</Label>
                <Select value={versionForm.organization} onValueChange={(v) => setVersionForm((p) => ({ ...p, organization: v }))}>
                  <SelectTrigger><SelectValue placeholder="選擇機構" /></SelectTrigger>
                  <SelectContent>
                    {organizations.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>分店（可選）</Label>
                <Select
                  value={versionForm.branch}
                  onValueChange={(v) => setVersionForm((p) => ({ ...p, branch: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="不指定" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">不指定</SelectItem>
                    {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>版本標籤（自動產生，可修改）</Label>
              <Input
                value={versionForm.version_label}
                onChange={(e) => {
                  setVersionLabelAuto(false)
                  setVersionForm((p) => ({ ...p, version_label: e.target.value }))
                }}
                placeholder="例：2026/06 第 1 週"
              />
            </div>

            <div className="space-y-2">
              <Label>快速設定期間</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  ['same-length', '沿用上期長度'],
                  ['month', '一個月'],
                  ['four-weeks', '四週'],
                  ['custom', '自訂'],
                ] as const).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={versionPreset === value ? 'default' : 'outline'}
                    onClick={() => applyPeriodPreset(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>期間開始</Label>
                <Input
                  type="date"
                  value={versionForm.period_start}
                  onChange={(e) => updateVersionDate('period_start', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>期間結束</Label>
                <Input
                  type="date"
                  value={versionForm.period_end}
                  onChange={(e) => updateVersionDate('period_end', e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowVersionDialog(false)}>取消</Button>
              <Button type="submit" disabled={createVersion.isPending}>
                {createVersion.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                建立
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== 排班 CRUD Dialog ===== */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSchedule ? '編輯排班' : '新增排班'}</DialogTitle>
            <DialogDescription>
              {selectedVersion ? `版本：${selectedVersion.version_label}（${selectedVersion.version_type === 'legal' ? 'A 法規版' : 'B 實際版'}）` : ''}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitSchedule} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>員工</Label>
                <Select value={scheduleForm.employee} onValueChange={(v) => setScheduleForm((p) => ({ ...p, employee: v }))}>
                  <SelectTrigger><SelectValue placeholder="選擇員工" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.user_name || `${e.user.first_name} ${e.user.last_name}`.trim() || e.user.username}（{e.employee_id}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>日期</Label>
                <Input
                  type="date"
                  min={selectedVersion?.period_start}
                  max={selectedVersion?.period_end}
                  value={scheduleForm.schedule_date}
                  onChange={(e) => setScheduleForm((p) => ({ ...p, schedule_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>班別</Label>
                <Select value={scheduleForm.shift_template} onValueChange={(v) => setScheduleForm((p) => ({ ...p, shift_template: v }))}>
                  <SelectTrigger><SelectValue placeholder="選擇班別" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}（{t.start_time.slice(0, 5)}-{t.end_time.slice(0, 5)}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>狀態</Label>
                <Select value={scheduleForm.status} onValueChange={(v) => setScheduleForm((p) => ({ ...p, status: v as ScheduleStatus }))}>
                  <SelectTrigger><SelectValue placeholder="選擇狀態" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="assigned">已指派</SelectItem>
                    <SelectItem value="confirmed">已確認</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="cancelled">已取消</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>備註</Label>
              <Input value={scheduleForm.notes} onChange={(e) => setScheduleForm((p) => ({ ...p, notes: e.target.value }))} placeholder="可選填" />
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <div>
                {editingSchedule && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={async () => {
                      await deleteSchedule.mutateAsync(editingSchedule.id)
                      setShowScheduleDialog(false)
                    }}
                    disabled={deleteSchedule.isPending}
                  >
                    刪除
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowScheduleDialog(false)}>取消</Button>
                <Button type="submit" disabled={createSchedule.isPending || updateSchedule.isPending}>
                  {(createSchedule.isPending || updateSchedule.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {editingSchedule ? '更新' : '建立'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== Compare Dialog ===== */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>版本差異比較</DialogTitle>
            <DialogDescription>
              {selectedVersion ? `版本 1：${selectedVersion.version_label}（${selectedVersion.version_type === 'legal' ? 'A' : 'B'}｜${selectedVersion.status_display}）` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-3 items-end">
            <div className="md:col-span-2 space-y-1.5">
              <Label>版本 2</Label>
              <Select value={compareVersion2Id} onValueChange={setCompareVersion2Id}>
                <SelectTrigger><SelectValue placeholder="選擇另一個版本" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>請選擇</SelectItem>
                  {versions
                    .filter((v) => !selectedVersion || v.id !== selectedVersion.id)
                    .map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.version_label}（{v.version_type === 'legal' ? 'A' : 'B'}｜{v.status_display}）
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={runCompare} disabled={!selectedVersion || compareLoading || compareVersion2Id === 'none'}>
              {compareLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              開始比較
            </Button>
          </div>

          {compareResult ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">只存在版本 1</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{compareResult.only_in_version1?.length ?? 0}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">只存在版本 2</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{compareResult.only_in_version2?.length ?? 0}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">欄位差異</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{compareResult.differences?.length ?? 0}</div></CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">差異明細</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-72 overflow-auto font-mono text-xs bg-muted/30 rounded-md p-3 whitespace-pre-wrap">
                    {JSON.stringify(compareResult, null, 2)}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">選擇版本 2 後點「開始比較」即可看到差異摘要。</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 匯出 Dialog ===== */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>匯出班表</DialogTitle>
            <DialogDescription>
              匯出 {selectedVersion?.version_label}（{selectedVersion?.version_type === 'legal' ? 'A 法規版' : 'B 實際版'}）指定期間的 Excel 班表，供列印、交接與勞檢對照。
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>起始日期</Label>
              <Input
                type="date"
                value={exportDateFrom}
                min={selectedVersion?.period_start}
                max={selectedVersion?.period_end}
                onChange={(e) => setExportDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>結束日期</Label>
              <Input
                type="date"
                value={exportDateTo}
                min={selectedVersion?.period_start}
                max={selectedVersion?.period_end}
                onChange={(e) => setExportDateTo(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>輸出格式</Label>
            <Select value={exportLayout} onValueChange={(value) => setExportLayout(value as ScheduleExportLayout)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">個人版表</SelectItem>
                <SelectItem value="integrated">整合班表</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {exportLayout === 'personal'
                ? '每位員工以個人月曆呈現，依序集中在同一工作表。'
                : '日期為列、員工為欄；所有員工會在同一工作表中向右延伸。'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>取消</Button>
            <Button onClick={runExport} disabled={exportLoading}>
              {exportLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              匯出 Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
