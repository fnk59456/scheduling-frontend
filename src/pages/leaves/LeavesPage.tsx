import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEmployees } from '@/hooks/useEmployees'
import {
  useApproveLeave,
  useCancelLeave,
  useCreateLeave,
  useLeaveBalances,
  useLeaveImpact,
  useLeaveRequests,
  useRejectLeave,
} from '@/hooks/useLeaves'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { LeaveBalanceItem, LeaveListParams, LeaveRequest, LeaveStatus, LeaveType } from '@/types/leave'
import { LEAVE_TYPE_OPTIONS } from '@/types/leave'

const statusStyles: Record<LeaveStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-300',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300',
}

function todayInput() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function personLabel(employee: { user_name: string; employee_id: string }) {
  return employee.user_name || employee.employee_id
}

function formatHours(minutes: number | null) {
  if (minutes === null) return '不限額'
  const hours = minutes / 60
  return `${Number(hours.toFixed(2))} 小時`
}

function dateRangeLabel(leave: Pick<LeaveRequest, 'start_date' | 'end_date' | 'total_days'>) {
  return leave.start_date === leave.end_date
    ? `${leave.start_date}（1 天）`
    : `${leave.start_date}～${leave.end_date}（${leave.total_days} 天）`
}

export default function LeavesPage() {
  const user = useAuthStore((state) => state.user)
  const hasRole = useAuthStore((state) => state.hasRole)
  const isSupervisor = hasRole(['admin', 'manager', 'supervisor'])
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveStatus>('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createMode, setCreateMode] = useState<'self' | 'proxy'>('self')
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null)

  const params = useMemo<LeaveListParams>(() => ({
    status: statusFilter === 'all' ? undefined : statusFilter,
    employee: employeeFilter === 'all' ? undefined : Number(employeeFilter),
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }), [dateFrom, dateTo, employeeFilter, statusFilter])

  const leaveQuery = useLeaveRequests(params, { allPages: true })
  const pendingQuery = useLeaveRequests({ status: 'pending' })
  const approvedQuery = useLeaveRequests({ status: 'approved' })
  const ownEmployeeId = user?.employee_pk ?? undefined
  const managerNeedsEmployeeProfile = (
    isSupervisor
    && user?.role_name !== 'admin'
    && !ownEmployeeId
  )
  const ownBalancesQuery = useLeaveBalances(ownEmployeeId, !!ownEmployeeId)
  const employeesQuery = useEmployees({ is_active: true }, { enabled: isSupervisor, allPages: true })
  const employees = isSupervisor ? employeesQuery.data?.results ?? [] : []
  const records = leaveQuery.data?.results ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">請假管理</h1>
          <p className="mt-1 text-muted-foreground">
            {isSupervisor ? '請假登記、單層審核與班表影響管理' : '查看自己的請假紀錄、狀態與特休餘額'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => leaveQuery.refetch()} disabled={leaveQuery.isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', leaveQuery.isFetching && 'animate-spin')} />
            重新整理
          </Button>
          {!!ownEmployeeId && (
            <Button onClick={() => { setCreateMode('self'); setShowCreate(true) }}>
              <Plus className="mr-2 h-4 w-4" />{isSupervisor ? '申請自己的假' : '申請請假'}
            </Button>
          )}
          {isSupervisor && (
            <Button variant={ownEmployeeId ? 'outline' : 'default'} onClick={() => { setCreateMode('proxy'); setShowCreate(true) }}>
              <Plus className="mr-2 h-4 w-4" />代員工登記
            </Button>
          )}
        </div>
      </div>

      {!ownEmployeeId && !isSupervisor && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-800/50 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-200">尚未建立員工資料</p>
            <p className="mt-1 text-amber-800/80 dark:text-amber-300/80">
              此登入帳號沒有對應的 Employee PK，請聯絡主管完成員工資料設定後再申請請假。
            </p>
          </div>
        </div>
      )}

      {managerNeedsEmployeeProfile && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          此主管帳號尚未連結員工資料，因此目前只能代員工登記；建立 Employee 關聯後即可申請自己的假。
        </div>
      )}

      <div className="grid max-w-xl grid-cols-2 gap-3">
        <SummaryCard title={isSupervisor ? '待審核' : '我的待審'} value={pendingQuery.data?.count ?? 0} icon={Clock3} tone="text-amber-600" />
        <SummaryCard title="已核准" value={approvedQuery.data?.count ?? 0} icon={CheckCircle2} tone="text-emerald-600" />
      </div>

      {!!ownEmployeeId && (
        <LeaveBalancePanel
          title="我的假別餘額"
          balances={ownBalancesQuery.data?.balances}
          loading={ownBalancesQuery.isLoading}
          error={ownBalancesQuery.isError}
        />
      )}

      <Card>
        <CardContent className="p-5">
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>狀態</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | LeaveStatus)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部狀態</SelectItem>
                  <SelectItem value="pending">待審核</SelectItem>
                  <SelectItem value="approved">已核准</SelectItem>
                  <SelectItem value="rejected">已駁回</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isSupervisor && (
              <div className="space-y-1.5">
                <Label>員工</Label>
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="全部員工" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部員工</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={String(employee.id)}>
                        {personLabel(employee)}（{employee.employee_id}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>開始日期</Label>
              <Input type="date" className="w-40" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>結束日期</Label>
              <Input type="date" className="w-40" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setStatusFilter('all')
                setEmployeeFilter('all')
                setDateFrom('')
                setDateTo('')
              }}
            >
              清除篩選
            </Button>
          </div>

          {leaveQuery.isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : leaveQuery.isError ? (
            <div className="py-14 text-center text-destructive">無法載入請假資料，請稍後重試。</div>
          ) : records.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground">
              <CalendarOff className="mx-auto mb-3 h-10 w-10 opacity-40" />
              查無請假申請
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    {['員工', '假別', '請假期間', '事由', '狀態', '申請時間'].map((heading) => (
                      <th key={heading} className="px-4 py-2.5 text-xs font-medium text-muted-foreground">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((leave) => (
                    <tr
                      key={leave.id}
                      className="cursor-pointer border-t transition hover:bg-muted/30"
                      onClick={() => setSelectedLeave(leave)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{leave.employee_name || leave.employee_code}</div>
                        <div className="text-[11px] text-muted-foreground">{leave.employee_code}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">{leave.leave_type_display}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">{dateRangeLabel(leave)}</td>
                      <td className="max-w-56 truncate px-4 py-3 text-muted-foreground">{leave.reason || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusStyles[leave.status]}>{leave.status_display}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {new Date(leave.created_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateLeaveDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        mode={createMode}
        ownEmployeeId={ownEmployeeId}
        ownEmployeeLabel={`${user?.last_name ?? ''}${user?.first_name ?? ''}`.trim() || user?.employee_code || user?.username || '目前登入者'}
        employees={employees}
      />
      <LeaveDetailDialog
        leave={selectedLeave}
        open={!!selectedLeave}
        onOpenChange={(open) => !open && setSelectedLeave(null)}
        isSupervisor={isSupervisor}
        ownEmployeeId={ownEmployeeId}
      />
    </div>
  )
}

function SummaryCard({ title, value, icon: Icon, tone }: {
  title: string
  value: number | string
  icon: React.ElementType
  tone: string
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-xs text-muted-foreground">{title}</span>
            <div className={cn('mt-0.5 text-xl font-bold leading-none', tone)}>{value}</div>
          </div>
          <span className="rounded-full bg-muted p-1.5"><Icon className={cn('h-4 w-4', tone)} /></span>
        </div>
      </CardContent>
    </Card>
  )
}

function LeaveBalancePanel({ title, balances, loading, error }: {
  title: string
  balances?: LeaveBalanceItem[]
  loading: boolean
  error: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <CalendarOff className="h-5 w-5 text-violet-600" />
          <h2 className="font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">單位：小時</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />載入假別餘額
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">無法載入假別餘額，請稍後重試。</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {(balances ?? []).map((balance) => (
              <div key={balance.leave_type} className="rounded-lg border bg-muted/10 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{balance.leave_type_display}</span>
                  <span className={cn(
                    'text-xs font-semibold',
                    balance.remaining_minutes !== null && balance.remaining_minutes < 0
                      ? 'text-destructive'
                      : 'text-violet-700 dark:text-violet-300',
                  )}>
                    {formatHours(balance.remaining_minutes)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                  <span>額度 <b className="font-medium text-foreground">{formatHours(balance.entitled_minutes)}</b></span>
                  <span>已用 <b className="font-medium text-foreground">{formatHours(balance.used_minutes)}</b></span>
                  <span>待審 <b className="font-medium text-foreground">{formatHours(balance.pending_minutes)}</b></span>
                </div>
                {balance.remaining_minutes !== null && balance.remaining_minutes < 0 && (
                  <p className="mt-2 text-xs text-destructive">已超出額度，後端仍允許送件。</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CreateLeaveDialog({ open, onOpenChange, mode, ownEmployeeId, ownEmployeeLabel, employees }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'self' | 'proxy'
  ownEmployeeId?: number
  ownEmployeeLabel: string
  employees: Array<{ id: number; employee_id: string; user_name: string }>
}) {
  const [employee, setEmployee] = useState('')
  const [leaveType, setLeaveType] = useState<LeaveType>('annual')
  const [startDate, setStartDate] = useState(todayInput)
  const [endDate, setEndDate] = useState(todayInput)
  const [reason, setReason] = useState('')
  const createLeave = useCreateLeave()
  const employeeId = mode === 'self' ? ownEmployeeId ?? 0 : Number(employee)
  const validRange = !!employeeId && !!startDate && !!endDate && startDate <= endDate
  const impactQuery = useLeaveImpact(validRange ? { employee: employeeId, start_date: startDate, end_date: endDate } : undefined)
  const balanceQuery = useLeaveBalances(employeeId, !!employeeId)
  const selectedBalance = balanceQuery.data?.balances.find((balance) => balance.leave_type === leaveType)
  const totalDays = startDate && endDate && startDate <= endDate
    ? Math.round((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86_400_000) + 1
    : 0

  const reset = () => {
    setEmployee('')
    setLeaveType('annual')
    setStartDate(todayInput())
    setEndDate(todayInput())
    setReason('')
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'self' ? '申請請假' : '代員工登記請假'}</DialogTitle>
          <DialogDescription>
            {mode === 'self'
              ? '送出後進入待審核狀態，需由其他主管處理。'
              : '主管替其他員工送出後會立即核准，並同步更新受影響的班表。'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!validRange) return
            await createLeave.mutateAsync({
              employee: employeeId,
              leave_type: leaveType,
              start_date: startDate,
              end_date: endDate,
              reason: reason.trim(),
            })
            onOpenChange(false)
            reset()
          }}
        >
          {mode === 'self' ? (
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              申請人：<span className="font-medium">{ownEmployeeLabel}</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>員工</Label>
              <Select value={employee} onValueChange={setEmployee}>
                <SelectTrigger><SelectValue placeholder="選擇員工" /></SelectTrigger>
                <SelectContent>
                  {employees.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {personLabel(item)}（{item.employee_id}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>假別</Label>
              <Select value={leaveType} onValueChange={(value) => setLeaveType(value as LeaveType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>開始日期</Label>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>結束日期</Label>
              <Input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>事由</Label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="可選填"
            />
          </div>

          {validRange && (
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoPanel
                title="班表影響"
                loading={impactQuery.isFetching}
                value={impactQuery.data ? `${impactQuery.data.affected_count} 個既有班次` : '查詢中'}
                detail={`請假期間共 ${totalDays} 個日曆天`}
                warning={(impactQuery.data?.affected_count ?? 0) > 0}
              />
              <InfoPanel
                title={`${LEAVE_TYPE_OPTIONS.find((option) => option.value === leaveType)?.label ?? '假別'}餘額`}
                loading={balanceQuery.isFetching}
                value={selectedBalance ? `剩餘 ${formatHours(selectedBalance.remaining_minutes)}` : '查詢中'}
                detail={selectedBalance ? `額度 ${formatHours(selectedBalance.entitled_minutes)}，已用 ${formatHours(selectedBalance.used_minutes)}，待審 ${formatHours(selectedBalance.pending_minutes)}` : '餘額僅供送件參考'}
                warning={!!selectedBalance && selectedBalance.remaining_minutes !== null && selectedBalance.remaining_minutes < 0}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={!validRange || createLeave.isPending}>
              {createLeave.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'self' ? '送出申請' : '登記並立即核准'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LeaveDetailDialog({ leave, open, onOpenChange, isSupervisor, ownEmployeeId }: {
  leave: LeaveRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isSupervisor: boolean
  ownEmployeeId?: number
}) {
  const [note, setNote] = useState('')
  const approveLeave = useApproveLeave()
  const rejectLeave = useRejectLeave()
  const cancelLeave = useCancelLeave()
  const impactQuery = useLeaveImpact(leave ? {
    employee: leave.employee,
    start_date: leave.start_date,
    end_date: leave.end_date,
  } : undefined)
  const balanceQuery = useLeaveBalances(leave?.employee, !!leave)
  const busy = approveLeave.isPending || rejectLeave.isPending || cancelLeave.isPending

  if (!leave) return null

  const selectedBalance = balanceQuery.data?.balances.find(
    (balance) => balance.leave_type === leave.leave_type,
  )
  const isOwnRequest = ownEmployeeId === leave.employee

  const close = () => {
    setNote('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{leave.employee_name || leave.employee_code} · {leave.leave_type_display}</DialogTitle>
            <Badge variant="outline" className={statusStyles[leave.status]}>{leave.status_display}</Badge>
          </div>
          <DialogDescription>
            {leave.employee_code} · {dateRangeLabel(leave)} · {leave.submission_source === 'manager_proxy' ? '主管代登記' : '本人申請'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoPanel
              title="受影響班次"
              loading={impactQuery.isFetching}
              value={impactQuery.data ? `${impactQuery.data.affected_count} 個班次` : '—'}
              detail={impactQuery.data?.affected_count ? '核准後由後端標記為請假' : '目前沒有既有班次'}
              warning={(impactQuery.data?.affected_count ?? 0) > 0}
            />
            <InfoPanel
              title={`${leave.leave_type_display}餘額`}
              loading={balanceQuery.isFetching}
              value={selectedBalance ? `剩餘 ${formatHours(selectedBalance.remaining_minutes)}` : '—'}
              detail={selectedBalance ? `額度 ${formatHours(selectedBalance.entitled_minutes)}，已用 ${formatHours(selectedBalance.used_minutes)}，待審 ${formatHours(selectedBalance.pending_minutes)}` : '目前沒有餘額資料'}
              warning={!!selectedBalance && selectedBalance.remaining_minutes !== null && selectedBalance.remaining_minutes < 0}
            />
          </div>

          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-xs font-medium text-muted-foreground">申請事由</p>
            <p className="mt-1 text-sm">{leave.reason || '未填寫'}</p>
            {leave.review_note && (
              <>
                <p className="mt-4 text-xs font-medium text-muted-foreground">審核備註</p>
                <p className="mt-1 text-sm">{leave.review_note}</p>
              </>
            )}
          </div>

          {impactQuery.data && impactQuery.data.schedules.length > 0 && (
            <div className="space-y-2">
              <Label>影響班次明細</Label>
              <div className="max-h-40 divide-y overflow-y-auto rounded-lg border">
                {impactQuery.data.schedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{schedule.schedule_date} · {schedule.shift_template.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {schedule.shift_template.start_time.slice(0, 5)}–{schedule.shift_template.end_time.slice(0, 5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isSupervisor && leave.status === 'pending' && isOwnRequest && (
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              這是你自己的請假申請，需由其他主管審核。
            </div>
          )}

          {isSupervisor && leave.status === 'pending' && !isOwnRequest && (
            <div className="space-y-1.5">
              <Label>審核備註／駁回理由</Label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="核准可選填；駁回時必填"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap sm:justify-between">
          <div>
            {((isSupervisor && leave.status === 'approved') || leave.status === 'pending') && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={busy || (!isSupervisor && leave.status !== 'pending')}
                onClick={async () => { await cancelLeave.mutateAsync(leave.id); close() }}
              >
                取消申請
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>關閉</Button>
            {isSupervisor && leave.status === 'pending' && !isOwnRequest && (
              <>
                <Button
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:text-destructive"
                  disabled={busy || !note.trim()}
                  onClick={async () => { await rejectLeave.mutateAsync({ id: leave.id, note: note.trim() }); close() }}
                >
                  <XCircle className="mr-2 h-4 w-4" />駁回
                </Button>
                <Button
                  disabled={busy}
                  onClick={async () => { await approveLeave.mutateAsync({ id: leave.id, note: note.trim() || undefined }); close() }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />核准
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InfoPanel({ title, value, detail, loading, warning = false }: {
  title: string
  value: string
  detail: string
  loading?: boolean
  warning?: boolean
}) {
  return (
    <div className={cn('rounded-lg border p-3', warning ? 'border-amber-200 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/20' : 'bg-muted/20')}>
      <p className="text-xs text-muted-foreground">{title}</p>
      <div className="mt-1 flex items-center gap-2 font-semibold">
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {value}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}
