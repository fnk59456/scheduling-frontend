import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  useApplyShiftPlanTemplate,
  useCopyShiftPlanFrom,
  useReplaceShiftPlanDay,
  useRestQuota,
  useShiftPlan,
} from '@/hooks/useSchedules'
import { useHolidayCalendar } from '@/hooks/useCompliance'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  SHIFT_PLAN_WEEKDAY_KEYS,
  SHIFT_PLAN_WEEKDAY_LABELS,
  countDaysWithoutPlan,
  eachIsoDate,
  formatIsoDate,
  gridToTemplate,
  groupPlanRowsByDate,
  parseIsoDate,
  rowsToTemplateGrid,
  templateGridError,
  templateToGrid,
  weekdayKeyOf,
  type TemplateGrid,
} from '@/lib/shiftPlan'
import type { ScheduleVersion, ShiftPlan, ShiftPlanWeekdayKey } from '@/types/schedule'
import type { ShiftTemplate } from '@/types/shift'

export type ShiftPlanStep = 'period' | 'template' | 'calendar'

type ShiftPlanDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: ScheduleVersion
  shiftTemplates: ShiftTemplate[]
  /** 可複製的其他班表（同機構） */
  sourceVersions: ScheduleVersion[]
  initialStep: ShiftPlanStep
  defaultPeriod: { start: string; end: string }
}

type DayDraft = Record<number, { enabled: boolean; min: string; max: string }>

const STEPS: { key: ShiftPlanStep; label: string }[] = [
  { key: 'period', label: '1. 選期間' },
  { key: 'template', label: '2. 星期範本' },
  { key: 'calendar', label: '3. 逐日微調' },
]

function monthStartOf(value: string) {
  const date = parseIsoDate(value)
  return formatIsoDate(new Date(date.getFullYear(), date.getMonth(), 1))
}

function monthEndOf(value: string) {
  const date = parseIsoDate(value)
  return formatIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

function shiftMonth(value: string, delta: number) {
  const date = parseIsoDate(value)
  return formatIsoDate(new Date(date.getFullYear(), date.getMonth() + delta, 1))
}

function shortShiftName(name: string) {
  return name.length > 2 ? name.slice(0, 2) : name
}

function planPeriodOf(plan: ShiftPlan) {
  const dates = plan.rows.map((row) => row.date).sort()
  return { start: dates[0], end: plan.period_end }
}

export function ShiftPlanDialog({
  open,
  onOpenChange,
  version,
  shiftTemplates,
  sourceVersions,
  initialStep,
  defaultPeriod,
}: ShiftPlanDialogProps) {
  const readOnly = version.status !== 'draft'
  const planQuery = useShiftPlan(open ? version.id : undefined)
  const plan = planQuery.data
  const applyTemplate = useApplyShiftPlanTemplate()
  const copyFrom = useCopyShiftPlanFrom()
  const replaceDay = useReplaceShiftPlanDay()

  const [step, setStep] = useState<ShiftPlanStep>(initialStep)
  const [periodStart, setPeriodStart] = useState(defaultPeriod.start)
  const [periodEnd, setPeriodEnd] = useState(defaultPeriod.end)
  const [grid, setGrid] = useState<TemplateGrid>({})
  const [showMax, setShowMax] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const [copySourceId, setCopySourceId] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(monthStartOf(defaultPeriod.start))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayDraft, setDayDraft] = useState<DayDraft>({})
  const initializedFor = useRef<number | null>(null)

  // 打開時依目前計畫初始化一次（期間、範本格子、日曆月份）
  useEffect(() => {
    if (!open) {
      initializedFor.current = null
      return
    }
    if (!plan || initializedFor.current === version.id) return
    initializedFor.current = version.id
    const hasRows = plan.rows.length > 0
    const period = hasRows ? planPeriodOf(plan) : defaultPeriod
    const nextGrid = Object.keys(plan.template ?? {}).length > 0
      ? templateToGrid(plan.template)
      : rowsToTemplateGrid(plan.rows)
    setStep(initialStep)
    setPeriodStart(period.start)
    setPeriodEnd(period.end)
    setGrid(nextGrid)
    setShowMax(Object.values(nextGrid).some((days) => Object.values(days).some((cell) => cell?.max)))
    setOverwrite(false)
    setCopySourceId('')
    setCalendarMonth(monthStartOf(period.start))
    setSelectedDate(null)
  }, [defaultPeriod, initialStep, open, plan, version.id])

  const periodDays = periodStart && periodEnd && periodStart <= periodEnd
    ? eachIsoDate(periodStart, periodEnd).length
    : 0
  const periodError = !periodStart || !periodEnd
    ? '請選擇開始與結束日期'
    : periodStart > periodEnd
      ? '結束日期不可早於開始日期'
      : periodDays > 92
        ? '單張班表的每日班別最多設定 92 天'
        : null

  const restQuotaQuery = useRestQuota(
    periodError
      ? undefined
      : {
        period_start: periodStart,
        period_end: periodEnd,
        organization_id: version.organization,
        branch_id: version.branch ?? undefined,
      },
    open && step === 'period',
  )

  const calendarEnd = monthEndOf(calendarMonth)
  const holidayQuery = useHolidayCalendar(calendarMonth, calendarEnd, open && step === 'calendar')
  const holidayByDate = useMemo(
    () => new Map((holidayQuery.data?.holidays ?? []).map((holiday) => [holiday.date, holiday])),
    [holidayQuery.data?.holidays],
  )
  const rowsByDate = useMemo(() => groupPlanRowsByDate(plan?.rows ?? []), [plan?.rows])
  const daysWithoutPlan = countDaysWithoutPlan(plan)

  const calendarCells = useMemo(() => {
    const first = parseIsoDate(calendarMonth)
    const leading = (first.getDay() + 6) % 7
    const days = eachIsoDate(calendarMonth, calendarEnd)
    return [...Array<string | null>(leading).fill(null), ...days]
  }, [calendarEnd, calendarMonth])

  const templateById = useMemo(() => new Map(shiftTemplates.map((shift) => [shift.id, shift])), [shiftTemplates])
  // 範本／計畫中可能含已停用的班別，一併列出以免資料被看不見
  const gridShifts = useMemo(() => {
    const ids = new Set([...shiftTemplates.map((shift) => shift.id), ...Object.keys(grid).map(Number)])
    return [...ids].map((id) => templateById.get(id) ?? {
      id,
      name: plan?.rows.find((row) => row.shift_template === id)?.shift_name ?? `班別 #${id}`,
      start_time: '',
      end_time: '',
    })
  }, [grid, plan?.rows, shiftTemplates, templateById])

  const setGridCell = (shiftId: number, key: ShiftPlanWeekdayKey, field: 'min' | 'max', value: string) => {
    setGrid((prev) => {
      const current = prev[shiftId]?.[key] ?? { min: '', max: '' }
      return { ...prev, [shiftId]: { ...(prev[shiftId] ?? {}), [key]: { ...current, [field]: value } } }
    })
  }

  const fillShiftRow = (shiftId: number) => {
    const monday = grid[shiftId]?.['0']
    if (!monday?.min) {
      toast({ title: '請先填寫週一人數', description: '會把週一的人數複製到週二～週日。' })
      return
    }
    setGrid((prev) => ({
      ...prev,
      [shiftId]: Object.fromEntries(SHIFT_PLAN_WEEKDAY_KEYS.map((key) => [key, { ...monday }])),
    }))
  }

  const submitTemplate = async () => {
    if (periodError) {
      setStep('period')
      return
    }
    const gridError = templateGridError(grid)
    if (gridError) {
      toast({ title: '範本有誤', description: gridError, variant: 'destructive' })
      return
    }
    const template = gridToTemplate(grid)
    if (Object.values(template).every((entries) => !entries || entries.length === 0)) {
      toast({ title: '請至少設定一個班別', description: '星期範本全部空白時，期間內每天都不會開班。', variant: 'destructive' })
      return
    }
    try {
      const result = await applyTemplate.mutateAsync({
        versionId: version.id,
        data: { template, period_start: periodStart, period_end: periodEnd, overwrite },
      })
      toast({ title: '已套用星期範本', description: `${periodStart} ~ ${periodEnd} 共設定 ${result.summary.days_planned} 天` })
      setCalendarMonth(monthStartOf(periodStart))
      setStep('calendar')
    } catch {
      // 錯誤訊息由 mutation 統一處理
    }
  }

  const submitCopy = async () => {
    if (!copySourceId || periodError) return
    try {
      const result = await copyFrom.mutateAsync({
        versionId: version.id,
        data: { source_version_id: Number(copySourceId), period_start: periodStart, period_end: periodEnd, overwrite },
      })
      setGrid(Object.keys(result.template ?? {}).length > 0 ? templateToGrid(result.template) : rowsToTemplateGrid(result.rows))
      toast({ title: '已複製班表的星期範本', description: '可在日曆上逐日微調。' })
      setCalendarMonth(monthStartOf(periodStart))
      setStep('calendar')
    } catch {
      // 錯誤訊息由 mutation 統一處理
    }
  }

  const openDay = (date: string) => {
    setSelectedDate(date)
    const rows = rowsByDate.get(date) ?? []
    const draft: DayDraft = {}
    for (const shift of shiftTemplates) {
      draft[shift.id] = { enabled: false, min: '1', max: '' }
    }
    for (const row of rows) {
      draft[row.shift_template] = {
        enabled: true,
        min: String(row.min_staff),
        max: row.max_staff == null ? '' : String(row.max_staff),
      }
    }
    setDayDraft(draft)
  }

  const saveDay = async (clear = false) => {
    if (!selectedDate) return
    const shifts = clear
      ? []
      : Object.entries(dayDraft)
        .filter(([, cell]) => cell.enabled && Number(cell.min) > 0)
        .map(([shiftId, cell]) => ({
          shift_template: Number(shiftId),
          min_staff: Number(cell.min),
          max_staff: cell.max === '' ? null : Number(cell.max),
        }))
    if (shifts.some((shift) => shift.max_staff !== null && shift.max_staff < shift.min_staff)) {
      toast({ title: '人數上限不可小於最低人數', variant: 'destructive' })
      return
    }
    try {
      await replaceDay.mutateAsync({ versionId: version.id, data: { date: selectedDate, shifts } })
      toast({
        title: shifts.length === 0 ? '這天已設為不開班' : '已更新這天的班別',
        description: selectedDate,
      })
      setSelectedDate(null)
    } catch {
      // 錯誤訊息由 mutation 統一處理
    }
  }

  const isSaving = applyTemplate.isPending || copyFrom.isPending || replaceDay.isPending
  const copyableVersions = sourceVersions.filter((item) => item.id !== version.id)

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            每日班別 — {version.version_label}
          </DialogTitle>
          <DialogDescription>
            班別模板只定義有哪些班；這張班表每一天開哪些班、各需要幾人在這裡決定。沒有設定的日子不會開班，AI 也不會排。
          </DialogDescription>
        </DialogHeader>

        {readOnly && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
            <Lock className="h-4 w-4 shrink-0" />
            已簽核版本的每日班別為唯讀；如需調整，請先取消簽核。
          </div>
        )}

        <div className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1" role="tablist" aria-label="每日班別設定步驟">
          {STEPS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={step === item.key}
              onClick={() => setStep(item.key)}
              disabled={readOnly && item.key !== 'calendar'}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                step === item.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {planQuery.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : planQuery.isError ? (
          <div className="py-10 text-center text-sm text-destructive">無法載入每日班別，請稍後重試。</div>
        ) : step === 'period' ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="shift-plan-start">開始日期</Label>
                <Input id="shift-plan-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shift-plan-end">結束日期</Label>
                <Input id="shift-plan-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
            {periodError ? (
              <p className="text-sm text-destructive">{periodError}</p>
            ) : (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                {restQuotaQuery.isLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />計算排休摘要…</span>
                ) : restQuotaQuery.data ? (
                  <>
                    <p>
                      共 {restQuotaQuery.data.period_days} 天 ｜ 週休 {restQuotaQuery.data.weekly_rest_days} 天
                      {restQuotaQuery.data.holiday_days > 0 && ` ＋ 國定假日 ${restQuotaQuery.data.holiday_days} 天`}
                      ｜ 月薪制最多上 {restQuotaQuery.data.work_days_max} 天
                    </p>
                    {restQuotaQuery.data.holidays.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {restQuotaQuery.data.holidays.map((holiday) => `${holiday.date.slice(5)} ${holiday.name}${holiday.kind === 'makeup' ? '（補假日）' : ''}`).join('、')}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">共 {periodDays} 天</span>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              下一步會依星期範本把這段期間的每一天展開成班別計畫；期間只會延長、不會縮短既有班表。
            </p>
          </div>
        ) : step === 'template' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {periodStart} ~ {periodEnd}：填寫每個星期幾各班需要幾人，空白或 0 ＝那天不開這個班。
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="w-36 p-2 text-left">班別</th>
                    {SHIFT_PLAN_WEEKDAY_LABELS.map((label) => (
                      <th key={label} className="p-2 text-center">週{label}</th>
                    ))}
                    <th className="w-20 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {gridShifts.length === 0 ? (
                    <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">尚未建立班別模板，請先到「系統設定 › 班別模板」新增。</td></tr>
                  ) : gridShifts.map((shift) => (
                    <tr key={shift.id} className="border-b last:border-b-0">
                      <td className="p-2">
                        <div className="font-medium">{shift.name}</div>
                        {shift.start_time && (
                          <div className="text-[11px] text-muted-foreground">{shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}</div>
                        )}
                      </td>
                      {SHIFT_PLAN_WEEKDAY_KEYS.map((key) => {
                        const cell = grid[shift.id]?.[key]
                        return (
                          <td key={key} className="p-1.5 text-center align-top">
                            <Input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              aria-label={`${shift.name} 週${SHIFT_PLAN_WEEKDAY_LABELS[Number(key)]} 人數`}
                              className="mx-auto h-8 w-14 px-1 text-center"
                              value={cell?.min ?? ''}
                              onChange={(e) => setGridCell(shift.id, key, 'min', e.target.value)}
                              disabled={readOnly}
                            />
                            {showMax && (
                              <Input
                                type="number"
                                min={0}
                                inputMode="numeric"
                                placeholder="上限"
                                aria-label={`${shift.name} 週${SHIFT_PLAN_WEEKDAY_LABELS[Number(key)]} 人數上限`}
                                className="mx-auto mt-1 h-7 w-14 px-1 text-center text-xs"
                                value={cell?.max ?? ''}
                                onChange={(e) => setGridCell(shift.id, key, 'max', e.target.value)}
                                disabled={readOnly}
                              />
                            )}
                          </td>
                        )
                      })}
                      <td className="p-1.5 text-center">
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => fillShiftRow(shift.id)} disabled={readOnly}>
                          同週一
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={showMax} onChange={(e) => setShowMax(e.target.checked)} />
                設定人數上限
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} disabled={readOnly} />
                覆蓋期間內已設定的日子
              </label>
            </div>
            <div className="rounded-lg border border-dashed p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Copy className="h-4 w-4" />複製上一張班表</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={copySourceId} onValueChange={setCopySourceId} disabled={readOnly || copyableVersions.length === 0}>
                  <SelectTrigger className="sm:flex-1">
                    <SelectValue placeholder={copyableVersions.length === 0 ? '沒有其他班表可複製' : '選擇來源班表'} />
                  </SelectTrigger>
                  <SelectContent>
                    {copyableVersions.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.version_label}（{item.status_display}，{item.period_start} ~ {item.period_end}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={submitCopy} disabled={readOnly || !copySourceId || !!periodError || isSaving}>
                  {copyFrom.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  複製並套用
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">直接沿用來源班表的星期範本展開到本期間，之後可在日曆逐日微調。</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {plan && plan.rows.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                這張班表尚未設定任何每日班別，AI 無法排班。請先到「2. 星期範本」套用範本。
              </div>
            ) : daysWithoutPlan > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                有 {daysWithoutPlan} 天尚未設定班別，AI 不會排這些天。
              </div>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Button type="button" variant="outline" size="sm" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))} aria-label="上個月">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium">{calendarMonth.slice(0, 4)} 年 {Number(calendarMonth.slice(5, 7))} 月</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))} aria-label="下個月">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                  {SHIFT_PLAN_WEEKDAY_LABELS.map((label) => <div key={label} className="py-1">週{label}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((date, index) => {
                    if (!date) return <div key={`blank-${index}`} />
                    const rows = rowsByDate.get(date) ?? []
                    const holiday = holidayByDate.get(date)
                    const inPeriod = !!plan && date >= plan.period_start && date <= plan.period_end
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => openDay(date)}
                        className={cn(
                          'min-h-[68px] rounded-md border p-1 text-left text-[11px] leading-tight transition hover:border-primary',
                          !inPeriod && 'opacity-50',
                          holiday?.kind === 'holiday' && 'border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/20',
                          holiday?.kind === 'makeup' && 'border-sky-200 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/20',
                          selectedDate === date && 'ring-2 ring-primary',
                        )}
                        aria-label={`${date} ${rows.length === 0 ? '未開班' : rows.map((row) => `${row.shift_name} ${row.min_staff} 人`).join('、')}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{Number(date.slice(8))}</span>
                          {holiday && <span className="truncate text-[10px] text-amber-700 dark:text-amber-300">{holiday.name}</span>}
                        </div>
                        {rows.length === 0 ? (
                          <div className="mt-1 text-muted-foreground">{inPeriod ? '未開班' : ''}</div>
                        ) : (
                          <div className="mt-1 space-y-0.5">
                            {rows.map((row) => (
                              <div key={row.shift_template} className="truncate">
                                {shortShiftName(row.shift_name)} {row.min_staff}{row.max_staff != null && row.max_staff !== row.min_staff ? `–${row.max_staff}` : ''}
                              </div>
                            ))}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-lg border p-3">
                {!selectedDate ? (
                  <p className="text-sm text-muted-foreground">點選日曆上的日期，調整當天開哪些班、各需幾人；清空＝那天不開班（例如院慶、颱風假）。</p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium">{selectedDate}（週{SHIFT_PLAN_WEEKDAY_LABELS[Number(weekdayKeyOf(selectedDate))]}）</p>
                      {holidayByDate.get(selectedDate) && (
                        <Badge variant="outline" className="mt-1 border-amber-300 text-amber-700">{holidayByDate.get(selectedDate)?.name}</Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      {shiftTemplates.map((shift) => {
                        const cell = dayDraft[shift.id] ?? { enabled: false, min: '1', max: '' }
                        const update = (patch: Partial<typeof cell>) => setDayDraft((prev) => ({ ...prev, [shift.id]: { ...cell, ...patch } }))
                        return (
                          <div key={shift.id} className="rounded-md border px-2 py-1.5">
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" className="h-4 w-4" checked={cell.enabled} onChange={(e) => update({ enabled: e.target.checked })} disabled={readOnly} aria-label={`開 ${shift.name}`} />
                              <span className="font-medium">{shift.name}</span>
                              <span className="text-[11px] text-muted-foreground">{shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}</span>
                            </label>
                            {cell.enabled && (
                              <div className="mt-1.5 flex items-center gap-2 text-xs">
                                <span>最少</span>
                                <Input type="number" min={1} className="h-7 w-14 px-1 text-center" value={cell.min} onChange={(e) => update({ min: e.target.value })} disabled={readOnly} aria-label={`${shift.name} 最少人數`} />
                                <span>上限</span>
                                <Input type="number" min={0} placeholder="不限" className="h-7 w-14 px-1 text-center" value={cell.max} onChange={(e) => update({ max: e.target.value })} disabled={readOnly} aria-label={`${shift.name} 人數上限`} />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {!readOnly && (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => saveDay()} disabled={isSaving}>
                          {replaceDay.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          儲存這天
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => saveDay(true)} disabled={isSaving}>
                          這天不開班
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <span className="self-center text-xs text-muted-foreground">
            {plan ? `已設定 ${plan.summary.days_planned} 天、${plan.summary.rows} 個班次` : ''}
          </span>
          <div className="flex gap-2">
            {step === 'period' && !readOnly && (
              <Button type="button" onClick={() => setStep('template')} disabled={!!periodError}>下一步：星期範本</Button>
            )}
            {step === 'template' && !readOnly && (
              <>
                <Button type="button" variant="outline" onClick={() => setStep('period')}>上一步</Button>
                <Button type="button" onClick={submitTemplate} disabled={isSaving || gridShifts.length === 0}>
                  {applyTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  套用到期間
                </Button>
              </>
            )}
            {step === 'calendar' && (
              <Button type="button" onClick={() => onOpenChange(false)} disabled={isSaving}>完成</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
