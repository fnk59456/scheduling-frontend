import { useEffect, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Settings2,
  CheckCircle, Clock, ShieldCheck, ShieldAlert, ArrowRight, AlertTriangle,
  CalendarDays, Download, FileCheck2, GitCompareArrows, MinusCircle,
  PencilLine, PlusCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOrganizations, useBranches } from '@/hooks/useOrganizations'
import { useEmployees } from '@/hooks/useEmployees'
import { useShiftRules, useShiftTemplates } from '@/hooks/useShifts'
import {
  useScheduleVersions,
  useCreateScheduleVersion,
  useApproveScheduleVersion,
  useUnapproveScheduleVersion,
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
  ScheduleCompareResult,
} from '@/types/schedule'
import { toast } from '@/hooks/use-toast'
import { scheduleVersionsApi, schedulesApi } from '@/api/endpoints/schedules'
import { employeesApi } from '@/api/endpoints/employees'
import { cn } from '@/lib/utils'
import {
  buildCrossVersionWarningMap,
  findCandidateCrossVersionOverlaps,
} from '@/lib/scheduleOverlap'
import { EmployeeMonthScheduleDialog } from './EmployeeMonthScheduleDialog'
import { WeekDatePicker } from './WeekDatePicker'
import type { EmployeeListItem } from '@/types/employee'

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

type VersionGroup = 'unapproved' | 'approved'
type CompareFilter = 'all' | 'removed' | 'added' | 'changed'

type CompareRow = {
  key: string
  kind: Exclude<CompareFilter, 'all'>
  date: string
  before?: Schedule
  after?: Schedule
}

function scheduleCompareKey(schedule: Schedule) {
  return `${schedule.employee.id}_${schedule.schedule_date}_${schedule.shift_template.id}`
}

function comparisonKeyDate(key: string) {
  return key.split('_')[1] ?? ''
}

function formatComparisonDate(value: string) {
  if (!value) return '日期不明'
  const date = parseDate(value)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日（週${weekdayLabels[(date.getDay() + 6) % 7]}）`
}

function scheduleEmployeeName(schedule?: Schedule) {
  if (!schedule) return '員工資料未載入'
  return schedule.employee.user_name || schedule.employee.employee_id || `員工 #${schedule.employee.id}`
}

function scheduleTimeLabel(schedule?: Schedule) {
  if (!schedule) return '班別資料未載入'
  return `${schedule.shift_template.name} · ${schedule.shift_template.start_time.slice(0, 5)}–${schedule.shift_template.end_time.slice(0, 5)}`
}

function CompareScheduleRow({ row }: { row: CompareRow }) {
  const schedule = row.after ?? row.before
  const changes = row.kind === 'changed' && row.before && row.after
    ? [
      row.before.expected_hours !== row.after.expected_hours
        ? { label: '工時', before: `${Number(row.before.expected_hours)} 小時`, after: `${Number(row.after.expected_hours)} 小時` }
        : null,
      row.before.status !== row.after.status
        ? { label: '狀態', before: row.before.status_display, after: row.after.status_display }
        : null,
      row.before.notes !== row.after.notes
        ? { label: '備註', before: row.before.notes || '無', after: row.after.notes || '無' }
        : null,
    ].filter((change): change is { label: string; before: string; after: string } => Boolean(change))
    : []

  const presentation = row.kind === 'added'
    ? { label: '版本 2 新增', icon: PlusCircle, color: 'text-emerald-700', surface: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20' }
    : row.kind === 'removed'
      ? { label: '版本 2 移除', icon: MinusCircle, color: 'text-rose-700', surface: 'border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20' }
      : { label: '內容異動', icon: PencilLine, color: 'text-amber-700', surface: 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20' }
  const Icon = presentation.icon

  return (
    <div className={cn('rounded-lg border p-3', presentation.surface)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', presentation.color)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-medium">{scheduleEmployeeName(schedule)}</p>
            <Badge variant="outline" className={cn('bg-background/70', presentation.color)}>{presentation.label}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{scheduleTimeLabel(schedule)}</p>

          {changes.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-current/10 pt-3">
              {changes.map((change) => (
                <div key={change.label} className="grid gap-1 text-sm sm:grid-cols-[4rem_1fr_auto_1fr] sm:items-center">
                  <span className="text-xs font-medium text-muted-foreground">{change.label}</span>
                  <span className="rounded-md bg-background/75 px-2 py-1 text-muted-foreground">{change.before}</span>
                  <ArrowRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                  <span className="rounded-md bg-background px-2 py-1 font-medium">{change.after}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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
  const [activeVersionGroup, setActiveVersionGroup] = useState<VersionGroup>('unapproved')

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
  const visibleVersions = useMemo(
    () => versions.filter((version) => version.status !== 'archived'),
    [versions],
  )
  const unapprovedVersions = useMemo(
    () => visibleVersions.filter((version) => version.status !== 'approved'),
    [visibleVersions],
  )
  const approvedVersions = useMemo(
    () => visibleVersions.filter((version) => version.status === 'approved'),
    [visibleVersions],
  )
  const versionsInActiveGroup = activeVersionGroup === 'approved' ? approvedVersions : unapprovedVersions

  const selectedVersion = visibleVersions.find((v) => String(v.id) === versionId) ?? null
  const canEditSelectedVersion = selectedVersion?.status === 'draft'

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
    if (selectedVersion) {
      setActiveVersionGroup(selectedVersion.status === 'approved' ? 'approved' : 'unapproved')
      return
    }
    const firstAvailable = unapprovedVersions[0] ?? approvedVersions[0]
    setActiveVersionGroup(unapprovedVersions.length > 0 ? 'unapproved' : 'approved')
    setVersionId(firstAvailable ? String(firstAvailable.id) : 'none')
  }, [approvedVersions, selectedVersion, unapprovedVersions, versionsLoading])

  useEffect(() => {
    if (!selectedVersion) return
    const requestedDate = versionNavigationDate ? parseDate(versionNavigationDate) : null
    const initialDate = requestedDate ?? parseDate(selectedVersion.period_start)
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
  const timelineVersions = useMemo(() => {
    if (!selectedVersion) return []
    return versions.filter((version) => (
      version.organization === selectedVersion.organization
      && version.version_type === selectedVersion.version_type
      && version.status !== 'archived'
    ))
  }, [selectedVersion, versions])
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
  const validationSchedules = useMemo(
    () => [...schedules, ...adjacentSchedules],
    [adjacentSchedules, schedules],
  )
  const versionResolutionByDate = useMemo(() => {
    const map = new Map<string, { version: ScheduleVersion | null; conflicts: ScheduleVersion[] }>()
    for (const day of weekDays) {
      map.set(fmtDate(day), { version: selectedVersion, conflicts: [] })
    }
    return map
  }, [selectedVersion, weekDays])
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
    for (const s of schedules) {
      const key = `${s.employee.id}:${s.schedule_date}`
      const values = map.get(key) ?? []
      values.push(s)
      map.set(key, values)
    }
    for (const values of map.values()) {
      values.sort((a, b) => a.shift_template.start_time.localeCompare(b.shift_template.start_time))
    }
    return map
  }, [schedules])

  const crossVersionWarningMap = useMemo(
    () => buildCrossVersionWarningMap(validationSchedules),
    [validationSchedules],
  )

  const immediateWarningMap = useMemo(() => {
    const map = new Map<number, string[]>()
    const add = (schedule: Schedule, message: string) => {
      const messages = map.get(schedule.id) ?? []
      if (!messages.includes(message)) messages.push(message)
      map.set(schedule.id, messages)
    }
    const schedulesByVersionEmployeeDate = new Map<string, Schedule[]>()
    for (const schedule of schedules) {
      const key = `${schedule.schedule_version}:${schedule.employee.id}:${schedule.schedule_date}`
      schedulesByVersionEmployeeDate.set(key, [
        ...(schedulesByVersionEmployeeDate.get(key) ?? []),
        schedule,
      ])
    }
    for (const daySchedules of schedulesByVersionEmployeeDate.values()) {
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
  }, [maxDailyHours, schedules])

  const createVersion = useCreateScheduleVersion()
  const approveVersion = useApproveScheduleVersion()
  const unapproveVersion = useUnapproveScheduleVersion()
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
  const [showUnapproveDialog, setShowUnapproveDialog] = useState(false)
  const [unapproveReason, setUnapproveReason] = useState('')

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

      const crossVersionOverlaps = findCandidateCrossVersionOverlaps({
        scheduleId: src.id,
        scheduleVersionId: selectedVersion.id,
        employeeId: targetEmployeeId,
        scheduleDate: targetDate,
        shiftTemplateId: src.shiftTemplateId,
      }, validationSchedules, templates)

      await schedulesApi.update(src.id, {
        ...srcBase,
        employee: targetEmployeeId,
        schedule_date: targetDate,
      })
      if (selectedVersion.version_type === 'legal') {
        await scheduleVersionsApi.update(selectedVersion.id, { version_type: 'actual' })
        await refetchVersions()
      }
      if (crossVersionOverlaps.length > 0) {
        const details = crossVersionOverlaps.slice(0, 3).map((schedule) => {
          const version = timelineVersions.find((item) => item.id === schedule.schedule_version)
          return `${version?.version_label ?? `版本 #${schedule.schedule_version}`} ${schedule.shift_template.start_time.slice(0, 5)}-${schedule.shift_template.end_time.slice(0, 5)}`
        })
        toast({
          title: `${targetSchedules.length ? '班次已合併' : '班次已移動'}，發現 ${crossVersionOverlaps.length} 筆跨版本重疊`,
          description: `${targetDate}：${details.join('、')}。本次操作已保留，請留意班次右下角警示。`,
        })
      } else {
        toast({
          title: targetSchedules.length ? '班次合併成功' : '移動成功',
          description: targetSchedules.length
            ? '班次已加入目標日期；如有同版本重疊或超時會顯示警告。'
            : '班表已移動',
        })
      }
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

    await performDrop(src, targetEmployeeId, targetDate)
  }

  const handleTimelineDrop = async (targetEmployeeId: number, targetDate: string) => {
    if (!canEditSelectedVersion) {
      setDragSource(null)
      setDragOver(null)
      toast({
        title: '已簽核版本不可編輯',
        description: '請先取消簽核後再調整班次。',
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
  })

  const openVersionDialog = () => {
    if (!orgIdResolved) {
      toast({ title: '請先指定機構', description: '排班管理必須指定機構後才能建立版本', variant: 'destructive' })
      return
    }
    const monthStart = startOfMonth(weekStart)
    setVersionForm({
      organization: String(orgIdResolved),
      branch: selectedVersion?.branch
        ? String(selectedVersion.branch)
        : branchId !== 'all' ? branchId : '',
      version_label: buildVersionLabel(monthStart, endOfMonth(monthStart)),
    })
    setShowVersionDialog(true)
  }

  const openCreateVersion = openVersionDialog

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
    const payload: ScheduleVersionCreateRequest = {
      organization: Number(versionForm.organization),
      branch: versionForm.branch ? Number(versionForm.branch) : null,
      version_label: versionForm.version_label.trim(),
      version_type: 'actual',
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
    if (!canEditSelectedVersion) {
      toast({
        title: '已簽核版本為唯讀',
        description: '請先取消簽核，才能新增或修改班次。',
        variant: 'destructive',
      })
      return
    }
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

  const openEditSchedule = (s: Schedule) => {
    const version = versions.find((item) => item.id === s.schedule_version)
    if (version?.status !== 'draft') {
      toast({
        title: '已簽核版本為唯讀',
        description: '請先取消簽核，才能新增或修改班次。',
        variant: 'destructive',
      })
      return
    }
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

  const submitSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVersion) return
    if (!scheduleForm.employee || !scheduleForm.schedule_date || !scheduleForm.shift_template) {
      toast({ title: '資料不完整', description: '請選擇員工、日期與班別', variant: 'destructive' })
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
    const crossVersionOverlaps = findCandidateCrossVersionOverlaps({
      scheduleId: editingSchedule?.id,
      scheduleVersionId: selectedVersion.id,
      employeeId: Number(scheduleForm.employee),
      scheduleDate: scheduleForm.schedule_date,
      shiftTemplateId: Number(scheduleForm.shift_template),
    }, validationSchedules, templates)

    if (editingSchedule) {
      await updateSchedule.mutateAsync({ id: editingSchedule.id, data: payloadBase })
    } else {
      await createSchedule.mutateAsync(payloadBase)
    }
    setShowScheduleDialog(false)
    resetWorkflow()
    if (crossVersionOverlaps.length > 0) {
      const details = crossVersionOverlaps.slice(0, 3).map((schedule) => {
        const version = timelineVersions.find((item) => item.id === schedule.schedule_version)
        return `${version?.version_label ?? `版本 #${schedule.schedule_version}`} ${schedule.shift_template.start_time.slice(0, 5)}-${schedule.shift_template.end_time.slice(0, 5)}`
      })
      toast({
        title: `已儲存，發現 ${crossVersionOverlaps.length} 筆跨版本重疊`,
        description: `${scheduleForm.schedule_date}：${details.join('、')}。簽核不會被阻擋，請於簽核總表裁決。`,
      })
    }
  }

  // ===== 版本比較 =====
  const [showCompareDialog, setShowCompareDialog] = useState(false)
  const [compareVersion2Id, setCompareVersion2Id] = useState<string>('none')
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareResult, setCompareResult] = useState<ScheduleCompareResult | null>(null)
  const [compareSchedules, setCompareSchedules] = useState<{ version1: Schedule[]; version2: Schedule[] }>({
    version1: [],
    version2: [],
  })
  const [compareFilter, setCompareFilter] = useState<CompareFilter>('all')

  const compareRows = useMemo<CompareRow[]>(() => {
    if (!compareResult) return []
    const version1ByKey = new Map(compareSchedules.version1.map((schedule) => [scheduleCompareKey(schedule), schedule]))
    const version2ByKey = new Map(compareSchedules.version2.map((schedule) => [scheduleCompareKey(schedule), schedule]))
    const rows: CompareRow[] = [
      ...compareResult.only_in_version1.map((key) => ({
        key,
        kind: 'removed' as const,
        date: version1ByKey.get(key)?.schedule_date ?? comparisonKeyDate(key),
        before: version1ByKey.get(key),
      })),
      ...compareResult.only_in_version2.map((key) => ({
        key,
        kind: 'added' as const,
        date: version2ByKey.get(key)?.schedule_date ?? comparisonKeyDate(key),
        after: version2ByKey.get(key),
      })),
      ...compareResult.differences.map((difference) => ({
        key: difference.key,
        kind: 'changed' as const,
        date: difference.version2.schedule_date || difference.version1.schedule_date,
        before: difference.version1,
        after: difference.version2,
      })),
    ]
    return rows.sort((left, right) => (
      left.date.localeCompare(right.date)
      || scheduleEmployeeName(left.after ?? left.before).localeCompare(scheduleEmployeeName(right.after ?? right.before), 'zh-TW')
    ))
  }, [compareResult, compareSchedules])

  const groupedCompareRows = useMemo(() => {
    const rows = compareFilter === 'all'
      ? compareRows
      : compareRows.filter((row) => row.kind === compareFilter)
    const groups = new Map<string, CompareRow[]>()
    rows.forEach((row) => groups.set(row.date, [...(groups.get(row.date) ?? []), row]))
    return Array.from(groups.entries())
  }, [compareFilter, compareRows])

  const openCompare = () => {
    if (!selectedVersion) return
    setCompareVersion2Id('none')
    setCompareResult(null)
    setCompareSchedules({ version1: [], version2: [] })
    setCompareFilter('all')
    setShowCompareDialog(true)
  }

  const runCompare = async () => {
    if (!selectedVersion || compareVersion2Id === 'none') return
    try {
      setCompareLoading(true)
      const version2Id = Number(compareVersion2Id)
      const [result, version1Schedules, version2Schedules] = await Promise.all([
        scheduleVersionsApi.compare(selectedVersion.id, version2Id),
        schedulesApi.listAll({ version: selectedVersion.id }),
        schedulesApi.listAll({ version: version2Id }),
      ])
      setCompareResult(result)
      setCompareSchedules({ version1: version1Schedules.results, version2: version2Schedules.results })
      setCompareFilter('all')
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
  const [exportLoading, setExportLoading] = useState(false)

  const openExport = () => {
    if (!selectedVersion) return
    const viewedMonth = weekDays[3]
    setExportDateFrom(fmtDate(startOfMonth(viewedMonth)))
    setExportDateTo(fmtDate(endOfMonth(viewedMonth)))
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
        employeesApi.listAll({
          is_active: true,
          organization: selectedVersion.organization,
          branch: branchId === 'all'
            ? (selectedVersion.branch ?? undefined)
            : Number(branchId),
        }),
      ])

      const versionLabel = `${selectedVersion.version_label}（${selectedVersion.version_type === 'legal' ? 'A 法規版' : 'B 實際版'}）`
      const { createScheduleWorkbook } = await import('@/lib/scheduleExcelExport')
      const buffer = await createScheduleWorkbook({
        schedules: scheduleResponse.results,
        employees: employeeResponse?.results,
        dateFrom: exportDateFrom,
        dateTo: exportDateTo,
        versionLabel,
        layout: 'integrated',
      })
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedVersion.version_label}_整合班表_${exportDateFrom}_${exportDateTo}.xlsx`
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
        <CardContent className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="flex h-7 items-center">機構（必選）</Label>
            <Select
              value={orgId}
              onValueChange={(v) => {
                setOrgId(v)
                setBranchId('all')
                setVersionId('none')
                setActiveVersionGroup('unapproved')
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
            <Label className="flex h-7 items-center">分店</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue placeholder="選擇分店" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="schedule-version-select" className="sr-only">排班版本</Label>
            <Tabs
              value={activeVersionGroup}
              onValueChange={(value) => {
                const nextGroup = value as VersionGroup
                const nextVersions = nextGroup === 'approved' ? approvedVersions : unapprovedVersions
                setActiveVersionGroup(nextGroup)
                setVersionId(nextVersions[0] ? String(nextVersions[0].id) : 'none')
                resetWorkflow()
              }}
            >
              <TabsList className="grid h-7 w-full grid-cols-2 p-0.5">
                <TabsTrigger value="unapproved" disabled={unapprovedVersions.length === 0} className="h-6 justify-center px-2 py-0 text-xs">
                  未簽核
                  <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{unapprovedVersions.length}</span>
                </TabsTrigger>
                <TabsTrigger value="approved" disabled={approvedVersions.length === 0} className="h-6 justify-center px-2 py-0 text-xs">
                  已簽核
                  <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{approvedVersions.length}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={versionId} onValueChange={(v) => { setVersionId(v); resetWorkflow() }} disabled={!orgIdResolved}>
              <SelectTrigger id="schedule-version-select"><SelectValue placeholder="選擇排班版本" /></SelectTrigger>
              <SelectContent>
                {versionsInActiveGroup.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {activeVersionGroup === 'approved' ? '尚無已簽核版本' : '尚無未簽核版本'}
                  </SelectItem>
                ) : (
                  versionsInActiveGroup.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.version_label}（{v.version_type === 'legal' ? 'A' : 'B'}｜{v.status_display}）
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedVersion && (
              <p className="text-xs text-muted-foreground mt-1">
                {selectedVersion.schedule_count > 0
                  ? `資料涵蓋：${selectedVersion.period_start} ~ ${selectedVersion.period_end}，共 ${selectedVersion.schedule_count} 筆`
                  : '尚無班次；系統將依排班自動更新資料涵蓋範圍'}
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
            {/* 簽核／取消簽核共用同一按鈕位置 */}
            <Button
              variant="outline"
              size="sm"
              className={cn(
                selectedVersion?.status === 'approved'
                  && 'border-destructive/40 text-destructive hover:bg-destructive/5',
              )}
              onClick={async () => {
                if (!selectedVersion) return
                if (selectedVersion.status === 'approved') {
                  setUnapproveReason('')
                  setShowUnapproveDialog(true)
                  return
                }
                await approveVersion.mutateAsync(selectedVersion.id)
              }}
              disabled={
                !selectedVersion
                || !['draft', 'approved'].includes(selectedVersion.status)
                || approveVersion.isPending
                || unapproveVersion.isPending
              }
            >
              {(approveVersion.isPending || unapproveVersion.isPending)
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : null}
              {selectedVersion?.status === 'approved' ? '取消簽核' : '簽核'}
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
              匯出整合班表
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>週排班表</CardTitle>
            <div className="flex items-center justify-end gap-1 sm:gap-2">
              <Button variant="outline" size="sm" onClick={prevWeek} aria-label="上一週">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <WeekDatePicker weekStart={weekStart} onSelectDate={(date) => setWeekStart(startOfWeek(date))} />
              <Button variant="outline" size="sm" onClick={nextWeek} aria-label="下一週">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                              handleTimelineDrop(e.id, date)
                            }}
                          >
                            {cellSchedules.length ? (
                              <div className="space-y-1">
                                {cellSchedules.map((schedule) => {
                                  const templateIndex = templates.findIndex((t) => t.id === schedule.shift_template.id)
                                  const chip = shiftChipColors[(templateIndex >= 0 ? templateIndex : 0) % shiftChipColors.length]
                                  const violation = violationMap.get(`${e.id}:${date}:${schedule.shift_template.id}`)
                                  const warnings = immediateWarningMap.get(schedule.id) ?? []
                                  const crossVersionSchedules = crossVersionWarningMap.get(schedule.id) ?? []
                                  const isHard = violation?.severity === 'hard' || warnings.length > 0
                                  const isCrossVersionWarning = crossVersionSchedules.length > 0
                                  const isSoft = (violation?.severity === 'soft' || isCrossVersionWarning) && !isHard
                                  const title = [
                                    ...warnings,
                                    ...crossVersionSchedules.map((other) => {
                                      const otherVersion = timelineVersions.find((version) => version.id === other.schedule_version)
                                      return `跨版本重疊：${otherVersion?.version_label ?? `#${other.schedule_version}`} · ${other.shift_template.name}`
                                    }),
                                    ...(violation ? [`${violation.rule_label}：${JSON.stringify(violation.detail)}`] : []),
                                  ].join('\n')
                                  return (
                                    <div
                                      key={schedule.id}
                                      draggable={canEditSelectedVersion}
                                      onDragStart={() => {
                                        if (!canEditSelectedVersion) return
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
                                        canEditSelectedVersion ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
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
                                        onClick={() => openEditSchedule(schedule)}
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
                                  openCreateScheduleAt(e.id, d)
                                }}
                              >
                                {isDragTarget
                                  ? <span className="font-medium text-primary">放置於此</span>
                                  : canEditSelectedVersion
                                    ? <><Plus className="h-3 w-3 inline mr-0.5" />指派</>
                                    : <span>已簽核鎖定</span>
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

      <Dialog open={showUnapproveDialog} onOpenChange={setShowUnapproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消簽核</DialogTitle>
            <DialogDescription>
              取消後版本會回到草稿並可再次編輯。請填寫原因，系統會保留稽核紀錄。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="unapprove-reason">取消原因（必填）</Label>
            <Input
              id="unapprove-reason"
              value={unapproveReason}
              onChange={(event) => setUnapproveReason(event.target.value)}
              placeholder="例如：需調整臨時請假班次"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowUnapproveDialog(false)}>
              返回
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!unapproveReason.trim() || unapproveVersion.isPending}
              onClick={async () => {
                if (!selectedVersion || !unapproveReason.trim()) return
                await unapproveVersion.mutateAsync({ id: selectedVersion.id, reason: unapproveReason.trim() })
                setShowUnapproveDialog(false)
                setUnapproveReason('')
              }}
            >
              {unapproveVersion.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              確認取消簽核
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {monthScheduleEmployee && selectedVersion && (
        <EmployeeMonthScheduleDialog
          open={monthScheduleOpen}
          onOpenChange={setMonthScheduleOpen}
          employee={monthScheduleEmployee}
          versionId={selectedVersion.id}
          versionLabel={`${selectedVersion.version_label}（${selectedVersion.version_type === 'legal' ? 'A 法規版' : 'B 實際版'}）`}
          initialMonth={weekDays[3]}
          origin={monthDialogOrigin}
          templates={templates}
          violations={complianceResult?.violations ?? []}
          versions={versions}
        />
      )}

      {/* ===== 新增版本 Dialog ===== */}
      <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增排班版本</DialogTitle>
            <DialogDescription>
              建立新排班版本（預設為實際版 B）。版本不限制起訖日期，系統會依實際班次自動維護資料涵蓋範圍。
            </DialogDescription>
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
              <Label>版本標籤</Label>
              <Input
                value={versionForm.version_label}
                onChange={(e) => setVersionForm((p) => ({ ...p, version_label: e.target.value }))}
                placeholder="例：2026 夏季排班"
              />
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
        <DialogContent className="max-h-[90vh] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="px-6 pb-4 pt-6">
            <DialogTitle className="flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5 text-primary" />
              版本差異比較
            </DialogTitle>
            <DialogDescription>查看兩個版本有哪些班次新增、移除或內容異動。</DialogDescription>
          </DialogHeader>

          <div className="grid items-end gap-3 border-t bg-muted/20 px-6 py-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label>
                比較對象
                {selectedVersion && <span className="ml-2 font-normal text-muted-foreground">版本 1：{selectedVersion.version_label}</span>}
              </Label>
              <Select value={compareVersion2Id} onValueChange={setCompareVersion2Id}>
                <SelectTrigger><SelectValue placeholder="選擇另一個版本" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>請選擇</SelectItem>
                  {visibleVersions
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
            <div className="min-h-0 space-y-4 overflow-y-auto border-t px-6 py-5">
              <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">版本 1</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{compareResult.version1.version_label}</p>
                    <Badge variant="outline">{compareResult.version1.version_type === 'legal' ? 'A 法規版' : 'B 實際版'}</Badge>
                    <Badge variant="secondary">{compareResult.version1.status_display}</Badge>
                  </div>
                </div>
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">VS</div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">版本 2</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{compareResult.version2.version_label}</p>
                    <Badge variant="outline">{compareResult.version2.version_type === 'legal' ? 'A 法規版' : 'B 實際版'}</Badge>
                    <Badge variant="secondary">{compareResult.version2.status_display}</Badge>
                  </div>
                </div>
              </div>

              <Tabs value={compareFilter} onValueChange={(value) => setCompareFilter(value as CompareFilter)}>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 md:grid-cols-4">
                  <TabsTrigger value="all" className="justify-center">
                    全部 <span className="tabular-nums text-muted-foreground">{compareRows.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="removed" className="justify-center data-[state=active]:text-rose-700">
                    移除 <span className="tabular-nums">{compareResult.only_in_version1.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="added" className="justify-center data-[state=active]:text-emerald-700">
                    新增 <span className="tabular-nums">{compareResult.only_in_version2.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="changed" className="justify-center data-[state=active]:text-amber-700">
                    異動 <span className="tabular-nums">{compareResult.differences.length}</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {groupedCompareRows.length > 0 ? (
                <div className="space-y-5">
                  {groupedCompareRows.map(([date, rows]) => (
                    <section key={date} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">{formatComparisonDate(date)}</h3>
                        <span className="text-xs text-muted-foreground">{rows.length} 項</span>
                      </div>
                      <div className="space-y-2">
                        {rows.map((row) => <CompareScheduleRow key={`${row.kind}-${row.key}`} row={row} />)}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed py-12 text-center">
                  <CheckCircle className="mx-auto h-9 w-9 text-emerald-600" />
                  <p className="mt-3 font-medium">{compareRows.length === 0 ? '兩個版本的班次完全相同' : '此分類沒有差異'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {compareRows.length === 0 ? '沒有新增、移除或內容異動。' : '切換上方分類可查看其他差異。'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="min-h-0 overflow-y-auto border-t px-6 py-12 text-center">
              <GitCompareArrows className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 font-medium">選擇另一個版本開始比較</p>
              <p className="mt-1 text-sm text-muted-foreground">結果會整理成新增、移除與內容異動，不會顯示原始程式資料。</p>
            </div>
          )}

          <DialogFooter className="border-t px-6 py-4">
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 匯出 Dialog ===== */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>匯出整合班表</DialogTitle>
            <DialogDescription>
              匯出 {selectedVersion?.version_label}（{selectedVersion?.version_type === 'legal' ? 'A 法規版' : 'B 實際版'}）指定期間的整合 Excel 班表。預設為目前瀏覽月份，仍可自行調整。
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>起始日期</Label>
              <Input
                type="date"
                value={exportDateFrom}
                onChange={(e) => setExportDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>結束日期</Label>
              <Input
                type="date"
                value={exportDateTo}
                onChange={(e) => setExportDateTo(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            日期為列、員工為欄；目前版本與所選日期範圍內的所有在職員工會在同一工作表中向右延伸。
          </p>
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
