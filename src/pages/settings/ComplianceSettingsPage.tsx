import { useMemo, useState } from 'react'
import { CalendarOff, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/authStore'
import {
  useComplianceSettings,
  useCreateHoliday,
  useDeleteHoliday,
  useHolidays,
  useUpdateComplianceSettings,
} from '@/hooks/useCompliance'
import { cn } from '@/lib/utils'

const weekdays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']

export default function ComplianceSettingsPage() {
  const organization = useAuthStore((state) => state.user?.organization)
  const settingsQuery = useComplianceSettings()
  const updateSettings = useUpdateComplianceSettings()
  const [year, setYear] = useState(new Date().getFullYear())
  const holidaysQuery = useHolidays(year)
  const createHoliday = useCreateHoliday()
  const deleteHoliday = useDeleteHoliday()
  const [holidayDate, setHolidayDate] = useState('')
  const [holidayName, setHolidayName] = useState('')

  const closedDays = useMemo(
    () => new Set(settingsQuery.data?.weekly_closed_days ?? []),
    [settingsQuery.data?.weekly_closed_days],
  )

  const toggleClosedDay = (weekday: number) => {
    if (!settingsQuery.data) return
    const next = new Set(closedDays)
    if (next.has(weekday)) next.delete(weekday)
    else next.add(weekday)
    updateSettings.mutate({ weekly_closed_days: [...next].sort((a, b) => a - b) })
  }

  const submitHoliday = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!organization || !holidayDate || !holidayName.trim()) return
    await createHoliday.mutateAsync({
      organization,
      date: holidayDate,
      name: holidayName.trim(),
    })
    setHolidayDate('')
    setHolidayName('')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarOff className="h-5 w-5" />每週固定公休日</CardTitle>
          <CardDescription>AI 排班與合規版本會自動避開；手動排班仍允許，但會顯示黃色提醒。</CardDescription>
        </CardHeader>
        <CardContent>
          {settingsQuery.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {weekdays.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleClosedDay(index)}
                  disabled={updateSettings.isPending}
                  aria-pressed={closedDays.has(index)}
                  className={cn(
                    'rounded-lg border px-3 py-3 text-sm font-medium transition-colors',
                    closedDays.has(index)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>國定假日／應放假日</CardTitle>
              <CardDescription className="mt-1">排在假日的班次會產生 soft 提醒，供管理者確認加倍給付。</CardDescription>
            </div>
            <Input
              type="number"
              className="w-28"
              value={year}
              min={2000}
              max={2100}
              onChange={(event) => setYear(Number(event.target.value))}
              aria-label="假日年度"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="grid gap-3 sm:grid-cols-[10rem_1fr_auto]" onSubmit={submitHoliday}>
            <div className="space-y-1.5">
              <Label htmlFor="holiday-date">日期</Label>
              <Input id="holiday-date" type="date" value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="holiday-name">名稱</Label>
              <Input id="holiday-name" value={holidayName} onChange={(event) => setHolidayName(event.target.value)} placeholder="例：國慶日" required />
            </div>
            <Button className="self-end" type="submit" disabled={!organization || createHoliday.isPending}>
              {createHoliday.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              新增
            </Button>
          </form>

          {holidaysQuery.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (holidaysQuery.data?.results.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">{year} 年尚未設定假日</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {holidaysQuery.data?.results.map((holiday) => (
                <div key={holiday.id} className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <p className="font-medium">{holiday.name}</p>
                    <p className="text-sm text-muted-foreground">{holiday.date}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteHoliday.mutate(holiday.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
