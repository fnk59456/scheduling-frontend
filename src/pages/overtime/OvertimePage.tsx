import { useMemo, useState } from 'react'
import { Calculator, CalendarDays, Clock, DollarSign, Loader2, PencilLine } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAttendances } from '@/hooks/useAttendance'
import { useCalculateOvertime, useOvertimeRecords, useUpdateOvertimeRecord } from '@/hooks/useOvertime'
import { useAuthStore } from '@/stores/authStore'
import type { OvertimeRecord } from '@/types/overtime'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return { date_from: `${month}-01`, date_to: `${month}-${String(lastDay).padStart(2, '0')}` }
}

function employeeName(record: { employee: { user_name: string; user: { first_name: string; last_name: string; username: string } } }) {
  const employee = record.employee
  return employee.user_name || `${employee.user.last_name}${employee.user.first_name}` || employee.user.username
}

export default function OvertimePage() {
  const [month, setMonth] = useState(currentMonth)
  const [editingRecord, setEditingRecord] = useState<OvertimeRecord | null>(null)
  const [showCalculateDialog, setShowCalculateDialog] = useState(false)
  const [selectedAttendanceId, setSelectedAttendanceId] = useState('')
  const [multiplier, setMultiplier] = useState('')
  const [notes, setNotes] = useState('')
  const canAdjust = useAuthStore((state) => state.hasRole(['admin', 'manager']))
  const updateRecord = useUpdateOvertimeRecord()
  const calculateOvertime = useCalculateOvertime()
  const range = useMemo(() => monthRange(month), [month])
  const { data, isLoading, isError } = useOvertimeRecords(range)
  const attendanceQuery = useAttendances(range, {
    enabled: showCalculateDialog && canAdjust,
    allPages: true,
  })
  const records = data?.results ?? []
  const completedAttendances = (attendanceQuery.data?.results ?? []).filter(
    (attendance) => attendance.actual_hours !== null && Number(attendance.actual_hours) > 0,
  )
  const totalHours = records.reduce((sum, record) => sum + Number(record.hours || 0), 0)
  const holidayHours = records.filter((record) => record.overtime_type === 'holiday').reduce((sum, record) => sum + Number(record.hours || 0), 0)
  const totalPay = records.reduce((sum, record) => sum + Number(record.calculated_amount || 0), 0)

  const openAdjustment = (record: OvertimeRecord) => {
    setEditingRecord(record)
    setMultiplier(record.multiplier)
    setNotes(record.notes)
  }

  const submitAdjustment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingRecord || !multiplier || Number(multiplier) <= 0) return
    await updateRecord.mutateAsync({
      id: editingRecord.id,
      data: { multiplier, notes: notes.trim() },
    })
    setEditingRecord(null)
  }

  const submitCalculation = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedAttendanceId) return
    await calculateOvertime.mutateAsync(Number(selectedAttendanceId))
    setShowCalculateDialog(false)
    setSelectedAttendanceId('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">加班管理</h1>
        <p className="mt-1 text-muted-foreground">依出勤紀錄檢視加班時數、倍率與國定假日加給說明</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-5"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>紀錄筆數</span><CalendarDays className="h-4 w-4" /></div><div className="mt-2 text-2xl font-bold">{records.length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>總加班時數</span><Clock className="h-4 w-4" /></div><div className="mt-2 text-2xl font-bold">{totalHours.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">小時</span></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>國定假日出勤</span><Clock className="h-4 w-4" /></div><div className="mt-2 text-2xl font-bold text-amber-600">{holidayHours.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">小時</span></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>已計算金額</span><DollarSign className="h-4 w-4" /></div><div className="mt-2 text-2xl font-bold text-emerald-600">NT$ {totalPay.toLocaleString()}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle>加班紀錄</CardTitle>
          <div className="flex items-center gap-2">
            {canAdjust && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedAttendanceId('')
                  setShowCalculateDialog(true)
                }}
              >
                <Calculator className="mr-2 h-4 w-4" />從出勤計算
              </Button>
            )}
            <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="w-40" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />載入加班紀錄中…</div>
          ) : isError ? (
            <p className="py-16 text-center text-sm text-destructive">無法載入加班紀錄，請稍後再試。</p>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground">
              <p>此月份沒有加班紀錄。</p>
              {canAdjust && (
                <Button variant="outline" size="sm" onClick={() => setShowCalculateDialog(true)}>
                  <Calculator className="mr-2 h-4 w-4" />從出勤紀錄建立
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-auto rounded-b-xl">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr className="text-left">
                  {['日期', '員工', '分店', '類型', '時數', '倍率', '計算金額', '說明', ''].map((heading, index) => <th key={`${heading}-${index}`} className="whitespace-nowrap px-4 py-2.5 text-xs font-medium text-muted-foreground">{heading}</th>)}
                </tr></thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-t align-top transition-colors hover:bg-muted/20">
                      <td className="whitespace-nowrap px-4 py-3">{record.overtime_date}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">{employeeName(record)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{record.employee.branch_name}</td>
                      <td className="whitespace-nowrap px-4 py-3"><Badge variant={record.overtime_type === 'holiday' ? 'default' : 'outline'}>{record.overtime_type_display}</Badge></td>
                      <td className="whitespace-nowrap px-4 py-3">{Number(record.hours).toFixed(2)} h</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono">× {Number(record.multiplier).toFixed(2)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono">{record.calculated_amount === null ? '—' : `NT$ ${Number(record.calculated_amount).toLocaleString()}`}</td>
                      <td className="min-w-72 px-4 py-3 text-muted-foreground">{record.overtime_type === 'holiday' && record.notes ? record.notes : '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {canAdjust && record.overtime_type === 'holiday' && (
                          <Button size="sm" variant="outline" onClick={() => openAdjustment(record)}>
                            <PencilLine className="mr-1 h-3.5 w-3.5" />調整倍率
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">月薪制國定假日以補休為原則；無法補休而需折發時，可由管理者調整倍率與備註。</p>

      <Dialog
        open={showCalculateDialog}
        onOpenChange={(open) => {
          if (calculateOvertime.isPending) return
          setShowCalculateDialog(open)
          if (!open) setSelectedAttendanceId('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>從出勤紀錄計算加班</DialogTitle>
            <DialogDescription>
              選擇一筆已有實際工時的出勤紀錄，系統會依排班、假日與員工薪制建立加班紀錄。
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitCalculation}>
            <div className="space-y-1.5">
              <Label>出勤紀錄</Label>
              <Select value={selectedAttendanceId} onValueChange={setSelectedAttendanceId} disabled={attendanceQuery.isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={attendanceQuery.isLoading ? '載入出勤紀錄中…' : '選擇員工與日期'} />
                </SelectTrigger>
                <SelectContent>
                  {completedAttendances.length === 0 ? (
                    <SelectItem value="__empty__" disabled>本月份沒有已完成的出勤紀錄</SelectItem>
                  ) : completedAttendances.map((attendance) => (
                    <SelectItem key={attendance.id} value={String(attendance.id)}>
                      {attendance.work_date}・{attendance.employee.user_name || attendance.employee.employee_id}・{Number(attendance.actual_hours).toFixed(2)} 小時
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">只列出已產生實際工時的出勤資料；沒有超時時不會建立加班紀錄。</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCalculateDialog(false)} disabled={calculateOvertime.isPending}>取消</Button>
              <Button type="submit" disabled={!selectedAttendanceId || calculateOvertime.isPending}>
                {calculateOvertime.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                開始計算
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editingRecord !== null} onOpenChange={(open) => !open && !updateRecord.isPending && setEditingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>調整國定假日加班倍率</DialogTitle>
            <DialogDescription>
              {editingRecord ? `${employeeName(editingRecord)}・${editingRecord.overtime_date}` : ''}。只有倍率與備註可調整。
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitAdjustment}>
            <div className="space-y-1.5">
              <Label htmlFor="overtime-multiplier">倍率</Label>
              <Input
                id="overtime-multiplier"
                type="number"
                min="0.01"
                max="99.99"
                step="0.01"
                value={multiplier}
                onChange={(event) => setMultiplier(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="overtime-notes">備註</Label>
              <textarea
                id="overtime-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingRecord(null)} disabled={updateRecord.isPending}>取消</Button>
              <Button type="submit" disabled={updateRecord.isPending || !multiplier || Number(multiplier) <= 0}>
                {updateRecord.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                儲存調整
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
