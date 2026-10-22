import { useMemo, useState } from 'react'
import {
  Clock, Loader2, RefreshCw, LogIn, LogOut, CheckCircle,
  AlertTriangle, XCircle, Timer, Upload, Download, Plus, Trash2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAttendances, useClockIn, useClockOut, useCreateAttendance, useUpdateAttendance, useDeleteAttendance } from '@/hooks/useAttendance'
import { useEmployees } from '@/hooks/useEmployees'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { Attendance } from '@/types/attendance'

function toDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtTime(s: string | null) {
  if (!s) return null
  // ISO datetime → HH:MM
  if (s.includes('T')) {
    const d = new Date(s)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return s.slice(0, 5)
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  const offset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offset).toISOString().slice(0, 16)
}

type StatusKey = 'normal' | 'late' | 'early' | 'absent' | 'overtime'

const statusConfig: Record<StatusKey, { label: string; icon: React.ElementType; badgeClass: string }> = {
  normal:   { label: '正常', icon: CheckCircle,    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30' },
  late:     { label: '遲到', icon: Clock,          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30' },
  early:    { label: '早退', icon: LogOut,         badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30' },
  absent:   { label: '缺勤', icon: XCircle,        badgeClass: 'bg-destructive/10 text-destructive border-destructive/20' },
  overtime: { label: '加班', icon: Timer,          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30' },
}

function deriveStatus(r: Attendance): StatusKey {
  if (r.anomaly_flag) return 'absent'
  if (r.actual_hours && Number(r.actual_hours) > 8.5) return 'overtime'
  return 'normal'
}

export default function AttendancePage() {
  const today = useMemo(() => new Date(), [])
  const [dateFrom, setDateFrom] = useState(() => toDateInput(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)))
  const [dateTo, setDateTo] = useState(() => toDateInput(today))
  const [onlyAnomaly, setOnlyAnomaly] = useState(false)
  const [selected, setSelected] = useState<Attendance | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [workDate, setWorkDate] = useState(() => toDateInput(today))
  const [clockInAt, setClockInAt] = useState(() => `${toDateInput(today)}T08:00`)
  const [clockOutAt, setClockOutAt] = useState(() => `${toDateInput(today)}T17:00`)
  const [notes, setNotes] = useState('')
  const [editClockIn, setEditClockIn] = useState('')
  const [editClockOut, setEditClockOut] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const canManage = useAuthStore((state) => state.hasRole(['admin', 'manager', 'supervisor']))

  const { data, isLoading, refetch, isFetching } = useAttendances({
    date_from: dateFrom,
    date_to: dateTo,
    anomaly: onlyAnomaly ? true : undefined,
  })

  const clockIn = useClockIn()
  const clockOut = useClockOut()
  const createAttendance = useCreateAttendance()
  const updateAttendance = useUpdateAttendance()
  const deleteAttendance = useDeleteAttendance()
  const { data: employeesData } = useEmployees({ is_active: true }, { enabled: canManage, allPages: true })

  const records = data?.results ?? []
  const busy = isLoading || isFetching || clockIn.isPending || clockOut.isPending || createAttendance.isPending || updateAttendance.isPending || deleteAttendance.isPending

  const normalCount = records.filter((r) => !r.anomaly_flag).length
  const anomalyCount = records.filter((r) => r.anomaly_flag).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">出勤管理</h1>
          <p className="text-muted-foreground mt-1">打卡紀錄與排班比對 · 異常自動標記</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />代建出勤
            </Button>
          ) : null}
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />匯入打卡
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />匯出報表
          </Button>
          <Button variant="secondary" onClick={() => clockOut.mutate()} disabled={busy}>
            {clockOut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
            下班打卡
          </Button>
          <Button onClick={() => clockIn.mutate()} disabled={busy}>
            {clockIn.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
            上班打卡
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={busy}>
            <RefreshCw className="h-4 w-4 mr-2" />重新比對
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { t: '查詢筆數', v: records.length, c: 'text-foreground', icon: Clock },
          { t: '正常',    v: normalCount,     c: 'text-emerald-600', icon: CheckCircle },
          { t: '異常',    v: anomalyCount,    c: 'text-rose-600',    icon: AlertTriangle },
          { t: '加班',    v: records.filter((r) => r.actual_hours && Number(r.actual_hours) > 8.5).length, c: 'text-amber-600', icon: Timer },
        ].map((s) => (
          <Card key={s.t}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{s.t}</span>
                <span className={cn('rounded-full p-1.5', s.c === 'text-foreground' ? 'bg-muted' : s.c.replace('text-', 'bg-').replace('-600', '-100'))}>
                  <s.icon className={cn('h-4 w-4', s.c)} />
                </span>
              </div>
              <div className={cn('text-2xl font-bold mt-2', s.c)}>{s.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <div className="space-y-1.5">
              <Label>查詢日期</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label>結束日期</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label>分店</Label>
              <Select defaultValue="all">
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分店</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex items-center gap-2 pb-0.5">
              <input
                type="checkbox"
                id="only-anomaly"
                className="h-4 w-4 accent-primary"
                checked={onlyAnomaly}
                onChange={(e) => setOnlyAnomaly(e.target.checked)}
              />
              <label htmlFor="only-anomaly" className="text-sm cursor-pointer select-none">只顯示異常</label>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : records.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
              查無出勤紀錄
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    {['員工', '班別', '排定時間', '打卡上班', '打卡下班', '實際工時', '狀態', '說明'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const statusKey = deriveStatus(r)
                    const cfg = statusConfig[statusKey]
                    const StatusIcon = cfg.icon
                    return (
                      <tr
                        key={r.id}
                        className="border-t hover:bg-muted/30 cursor-pointer"
                        onClick={() => {
                          setSelected(r)
                          setEditClockIn(toDateTimeLocal(r.clock_in))
                          setEditClockOut(toDateTimeLocal(r.clock_out))
                          setEditNotes(r.notes || '')
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                              {(r.employee.user_name || r.employee.employee_id).slice(0, 1)}
                            </div>
                            <div>
                              <div className="font-medium">{r.employee.user_name || r.employee.employee_id}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">{r.employee.employee_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{r.employee.position || '—'}</Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">—</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {fmtTime(r.clock_in) ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {fmtTime(r.clock_out) ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {r.actual_hours ? `${r.actual_hours} h` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cfg.badgeClass}>
                            <StatusIcon className="h-3 w-3 mr-1" />{cfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {r.anomaly_reason ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        {selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected.employee.user_name ?? selected.employee.employee_id} · {selected.work_date}</DialogTitle>
              <DialogDescription>出勤紀錄詳情與異常處理</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Card className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">打卡上班</div>
                    <div className="font-mono font-medium mt-1">{fmtTime(selected.clock_in) ?? '—'}</div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">打卡下班</div>
                    <div className="font-mono font-medium mt-1">{fmtTime(selected.clock_out) ?? '—'}</div>
                  </CardContent>
                </Card>
              </div>
              {selected.anomaly_flag && selected.anomaly_reason && (
                <div className="rounded-lg bg-amber-50/80 border border-amber-200 p-3 text-sm dark:bg-amber-950/20 dark:border-amber-800/40">
                  <div className="font-medium text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />異常說明
                  </div>
                  <div className="text-amber-900/80 dark:text-amber-300 mt-1">{selected.anomaly_reason}</div>
                </div>
              )}
              {canManage ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5"><Label>上班時間</Label><Input type="datetime-local" value={editClockIn} onChange={(e) => setEditClockIn(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>下班時間</Label><Input type="datetime-local" value={editClockOut} onChange={(e) => setEditClockOut(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>備註</Label><Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="例：客戶測試代建" /></div>
                </>
              ) : null}
            </div>
            <DialogFooter>
              {canManage ? <Button variant="destructive" className="mr-auto" disabled={busy} onClick={async () => {
                if (!window.confirm('確定刪除這筆出勤紀錄？')) return
                await deleteAttendance.mutateAsync(selected.id)
                setSelected(null)
              }}><Trash2 className="mr-2 h-4 w-4" />刪除</Button> : null}
              <Button variant="outline" onClick={() => setSelected(null)}>取消</Button>
              {canManage ? <Button disabled={busy || !editClockIn || !editClockOut} onClick={async () => {
                await updateAttendance.mutateAsync({ id: selected.id, data: { clock_in: new Date(editClockIn).toISOString(), clock_out: new Date(editClockOut).toISOString(), notes: editNotes } })
                setSelected(null)
              }}>儲存</Button> : null}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>管理者代建出勤</DialogTitle>
            <DialogDescription>直接建立正式出勤紀錄，工時、遲到、早退與無排班出勤將由系統重算。此流程不含員工申請與簽核。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>員工</Label><Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder="選擇員工" /></SelectTrigger><SelectContent>{employeesData?.results.map((employee) => <SelectItem key={employee.id} value={String(employee.id)}>{employee.user_name || employee.employee_id} · {employee.employee_id}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>出勤日</Label><Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} /></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5"><Label>上班時間</Label><Input type="datetime-local" value={clockInAt} onChange={(e) => setClockInAt(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>下班時間</Label><Input type="datetime-local" value={clockOutAt} onChange={(e) => setClockOutAt(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>備註</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="代建原因或測試說明" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button disabled={busy || !employeeId || !workDate || !clockInAt || !clockOutAt} onClick={async () => {
              await createAttendance.mutateAsync({ employee_id: Number(employeeId), work_date: workDate, clock_in: new Date(clockInAt).toISOString(), clock_out: new Date(clockOutAt).toISOString(), notes })
              setCreateOpen(false)
              setNotes('')
            }}>建立出勤</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
