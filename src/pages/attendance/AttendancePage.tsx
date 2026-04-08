import { useMemo, useState } from 'react'
import { Clock, Loader2, RefreshCw, LogIn, LogOut, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAttendances, useClockIn, useClockOut } from '@/hooks/useAttendance'

function toDateInput(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function fmtDT(s: string | null) {
  if (!s) return '--'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

export default function AttendancePage() {
  const today = useMemo(() => new Date(), [])
  const [dateFrom, setDateFrom] = useState(() => toDateInput(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)))
  const [dateTo, setDateTo] = useState(() => toDateInput(today))
  const [onlyAnomaly, setOnlyAnomaly] = useState(false)

  const { data, isLoading, refetch, isFetching } = useAttendances({
    date_from: dateFrom,
    date_to: dateTo,
    anomaly: onlyAnomaly ? true : undefined,
  })

  const clockIn = useClockIn()
  const clockOut = useClockOut()

  const records = data?.results ?? []

  const busy = isLoading || isFetching || clockIn.isPending || clockOut.isPending

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">出勤打卡</h1>
          <p className="text-muted-foreground mt-1">第 5 週：上/下班打卡、出勤紀錄查詢</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={busy}>
            <RefreshCw className="h-4 w-4 mr-2" />
            重新整理
          </Button>
          <Button onClick={() => clockIn.mutate()} disabled={busy}>
            {clockIn.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
            上班打卡
          </Button>
          <Button variant="secondary" onClick={() => clockOut.mutate()} disabled={busy}>
            {clockOut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
            下班打卡
          </Button>
        </div>
      </div>

      <Card className="card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            查詢條件
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4 items-end">
          <div className="space-y-1.5">
            <Label>開始日期</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>結束日期</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={onlyAnomaly}
                onChange={(e) => setOnlyAnomaly(e.target.checked)}
              />
              <span className="text-sm">只看異常</span>
            </div>
            <span className="text-xs text-muted-foreground">
              員工帳號預設只能看到自己的出勤；主管可用後端參數擴充（第 6 週）。
            </span>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            查無出勤紀錄
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {records.map((r) => (
            <Card key={r.id} className="card-hover">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{r.work_date}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.employee.user_name || r.employee.employee_id} · {r.employee.position} · {r.employee.branch_name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.anomaly_flag ? (
                      <Badge variant="destructive" className="gap-1 border-0">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        異常
                      </Badge>
                    ) : (
                      <Badge variant="secondary">正常</Badge>
                    )}
                    {r.actual_hours ? (
                      <Badge variant="outline">{r.actual_hours} 小時</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2 mt-4 md:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">上班打卡</div>
                    <div className="font-mono text-sm mt-1">{fmtDT(r.clock_in)}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">下班打卡</div>
                    <div className="font-mono text-sm mt-1">{fmtDT(r.clock_out)}</div>
                  </div>
                </div>

                {r.anomaly_flag && r.anomaly_reason ? (
                  <div className="mt-3 text-sm text-destructive">
                    異常原因：{r.anomaly_reason}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

