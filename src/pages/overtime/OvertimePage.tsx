import { useMemo, useState } from 'react'
import { CalendarDays, Clock, DollarSign, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useOvertimeRecords } from '@/hooks/useOvertime'

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
  const range = useMemo(() => monthRange(month), [month])
  const { data, isLoading, isError } = useOvertimeRecords(range)
  const records = data?.results ?? []
  const totalHours = records.reduce((sum, record) => sum + Number(record.hours || 0), 0)
  const holidayHours = records.filter((record) => record.overtime_type === 'holiday').reduce((sum, record) => sum + Number(record.hours || 0), 0)
  const totalPay = records.reduce((sum, record) => sum + Number(record.calculated_amount || 0), 0)

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
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>加班紀錄</CardTitle>
          <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="w-40" />
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />載入加班紀錄中…</div>
          ) : isError ? (
            <p className="py-16 text-center text-sm text-destructive">無法載入加班紀錄，請稍後再試。</p>
          ) : records.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">此月份沒有加班紀錄。</p>
          ) : (
            <div className="overflow-auto rounded-b-xl">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr className="text-left">
                  {['日期', '員工', '分店', '類型', '時數', '倍率', '計算金額', '說明'].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-2.5 text-xs font-medium text-muted-foreground">{heading}</th>)}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">月薪制國定假日以補休為原則；時薪制依國定假日規則計算。倍率由後端計算，目前紀錄 API 為唯讀。</p>
    </div>
  )
}
