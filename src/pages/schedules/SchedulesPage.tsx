import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Settings2,
  CheckCircle, Clock, ShieldCheck, ShieldAlert, ArrowRight, AlertTriangle,
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
import { useShiftTemplates } from '@/hooks/useShifts'
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
  ScheduleVersionCreateRequest,
  ComplianceViolation,
  CheckComplianceResult,
  DeriveLegalResult,
} from '@/types/schedule'
import { toast } from '@/hooks/use-toast'
import { scheduleVersionsApi } from '@/api/endpoints/schedules'
import { cn } from '@/lib/utils'

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

function clampDate(d: Date, min?: Date, max?: Date) {
  const t = d.getTime()
  if (min && t < min.getTime()) return new Date(min)
  if (max && t > max.getTime()) return new Date(max)
  return d
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

type WorkflowPhase = 'editing' | 'checking' | 'violations' | 'done'

export default function SchedulesPage() {
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

  // 查所有版本（不依版本類型篩選）
  const { data: versionsData, isLoading: versionsLoading, refetch: refetchVersions } = useScheduleVersions({
    organization: orgIdResolved ?? undefined,
  })
  const versions = versionsData?.results ?? []

  const selectedVersion = versions.find((v) => String(v.id) === versionId) ?? null

  const periodStart = selectedVersion ? parseDate(selectedVersion.period_start) : null
  const periodEnd = selectedVersion ? parseDate(selectedVersion.period_end) : null

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))

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
    const clamped = clampDate(startOfWeek(weekStart), periodStart ?? undefined, periodEnd ?? undefined)
    setWeekStart(clamped)
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

  const scheduleByEmployeeDate = useMemo(() => {
    const map = new Map<string, Schedule>()
    for (const s of schedules) {
      map.set(`${s.employee.id}:${s.schedule_date}`, s)
    }
    return map
  }, [schedules])

  const createVersion = useCreateScheduleVersion()
  const approveVersion = useApproveScheduleVersion()
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const checkCompliance = useCheckCompliance()
  const deriveLegal = useDeriveLegal()
  const updateVersion = useUpdateScheduleVersion()

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

  // ===== 建立版本對話框 =====
  const [showVersionDialog, setShowVersionDialog] = useState(false)
  const [versionForm, setVersionForm] = useState({
    organization: '',
    branch: '',
    version_label: '',
    period_start: '',
    period_end: '',
  })

  const openCreateVersion = () => {
    if (!orgIdResolved) {
      toast({ title: '請先指定機構', description: '排班管理必須指定機構後才能建立版本', variant: 'destructive' })
      return
    }
    setVersionForm({
      organization: String(orgIdResolved),
      branch: branchId !== 'all' ? branchId : '',
      version_label: '',
      period_start: '',
      period_end: '',
    })
    setShowVersionDialog(true)
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

  // ===== 週導航 =====
  const prevWeek = () => {
    const next = addDays(weekStart, -7)
    setWeekStart(clampDate(next, periodStart ?? undefined, periodEnd ?? undefined))
  }
  const nextWeek = () => {
    const next = addDays(weekStart, 7)
    setWeekStart(clampDate(next, periodStart ?? undefined, periodEnd ?? undefined))
  }
  const canGoPrev = !periodStart || weekStart.getTime() > startOfWeek(periodStart).getTime()
  const canGoNext = !periodEnd || addDays(weekStart, 6).getTime() < periodEnd.getTime()

  const isBusy = schedulesLoading || employeesLoading || versionsLoading

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
            {/* Compare */}
            <Button variant="outline" size="sm" onClick={openCompare} disabled={!selectedVersion}>
              Compare 差異
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
              <Button variant="outline" size="sm" onClick={prevWeek} disabled={!canGoPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium">{dateFrom} ~ {dateTo}</div>
              <Button variant="outline" size="sm" onClick={nextWeek} disabled={!canGoNext}>
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
                    {weekDays.map((d, idx) => (
                      <th key={idx} className="text-left p-3 min-w-32">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">週{weekdayLabels[idx]}</span>
                          <span className="text-xs text-muted-foreground">{fmtDate(d).slice(5)}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="p-3 align-top">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                            {(e.user_name || e.user.first_name || e.user.username).slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{e.user_name || `${e.user.first_name} ${e.user.last_name}`.trim() || e.user.username}</div>
                            <div className="text-[11px] text-muted-foreground">{e.employee_id} · {e.position}</div>
                          </div>
                        </div>
                      </td>
                      {weekDays.map((d) => {
                        const date = fmtDate(d)
                        const key = `${e.id}:${date}`
                        const s = scheduleByEmployeeDate.get(key)
                        const tplIdx = s ? templates.findIndex((t) => t.id === s.shift_template.id) : -1
                        const chip = tplIdx >= 0 ? shiftChipColors[tplIdx % shiftChipColors.length] : null

                        // 違規 highlight
                        const vKey = s ? `${e.id}:${date}:${s.shift_template.id}` : ''
                        const violation = vKey ? violationMap.get(vKey) : undefined
                        const isHard = violation?.severity === 'hard'
                        const isSoft = violation?.severity === 'soft'

                        return (
                          <td key={date} className="p-1.5 align-top">
                            {s && chip ? (
                              <button
                                type="button"
                                className={cn(
                                  'w-full text-left rounded-md border px-2 py-2 transition hover:shadow-sm',
                                  isHard
                                    ? 'border-destructive bg-destructive/10 ring-2 ring-destructive/30'
                                    : isSoft
                                      ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-300/40'
                                      : `${chip.bg} ${chip.border}`,
                                )}
                                onClick={() => openEditSchedule(s)}
                                title={violation ? `${violation.rule_label}：${JSON.stringify(violation.detail)}` : undefined}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className={cn('font-semibold text-xs', isHard ? 'text-destructive' : isSoft ? 'text-amber-700' : chip.text)}>
                                    {s.shift_template.name}
                                  </span>
                                  {isHard ? (
                                    <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                                  ) : isSoft ? (
                                    <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                                  ) : s.status === 'confirmed' ? (
                                    <CheckCircle className="h-3 w-3 text-emerald-600 shrink-0" />
                                  ) : (
                                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                  {s.shift_template.start_time.slice(0, 5)}-{s.shift_template.end_time.slice(0, 5)}
                                </div>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="w-full rounded-md border border-dashed px-2 py-5 text-muted-foreground hover:bg-muted/40 hover:border-primary/40 transition text-xs"
                                onClick={() => openCreateScheduleAt(e.id, d)}
                              >
                                <Plus className="h-3 w-3 inline mr-0.5" />指派
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
              <Label>版本標籤</Label>
              <Input
                value={versionForm.version_label}
                onChange={(e) => setVersionForm((p) => ({ ...p, version_label: e.target.value }))}
                placeholder="例：2026/06 第 1 週"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>期間開始</Label>
                <Input type="date" value={versionForm.period_start} onChange={(e) => setVersionForm((p) => ({ ...p, period_start: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>期間結束</Label>
                <Input type="date" value={versionForm.period_end} onChange={(e) => setVersionForm((p) => ({ ...p, period_end: e.target.value }))} />
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
                <Input type="date" value={scheduleForm.schedule_date} onChange={(e) => setScheduleForm((p) => ({ ...p, schedule_date: e.target.value }))} />
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
    </div>
  )
}
