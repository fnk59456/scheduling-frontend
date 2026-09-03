import { useEffect, useMemo, useState } from 'react'
import { Clock3, Loader2, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLeaveSettings, useUpdateLeaveSettings } from '@/hooks/useLeaves'
import type { LeaveQuotaSetting } from '@/types/leave'

function minutesToHours(minutes: number) {
  return String(Number((minutes / 60).toFixed(2)))
}

export default function LeaveSettingsPage() {
  const settingsQuery = useLeaveSettings()
  const updateSettings = useUpdateLeaveSettings()
  const [dayHours, setDayHours] = useState('8')
  const [quotaHours, setQuotaHours] = useState<Record<string, string>>({})
  const [unlimited, setUnlimited] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!settingsQuery.data) return
    setDayHours(minutesToHours(settingsQuery.data.day_minutes))
    setQuotaHours(Object.fromEntries(
      settingsQuery.data.quotas.map((quota) => [
        quota.leave_type,
        quota.annual_quota_minutes === null
          ? ''
          : minutesToHours(quota.annual_quota_minutes),
      ]),
    ))
    setUnlimited(Object.fromEntries(
      settingsQuery.data.quotas.map((quota) => [
        quota.leave_type,
        quota.annual_quota_minutes === null,
      ]),
    ))
  }, [settingsQuery.data])

  const validationError = useMemo(() => {
    const parsedDayHours = Number(dayHours)
    if (!Number.isFinite(parsedDayHours) || parsedDayHours < 1 || parsedDayHours > 24) {
      return '一天換算時數必須介於 1 到 24 小時。'
    }
    for (const quota of settingsQuery.data?.quotas ?? []) {
      if (unlimited[quota.leave_type]) continue
      const value = Number(quotaHours[quota.leave_type])
      if (!Number.isFinite(value) || value < 0) {
        return `${quota.leave_type_display}的年度額度必須是 0 以上的時數。`
      }
    }
    return null
  }, [dayHours, quotaHours, settingsQuery.data?.quotas, unlimited])

  const save = async () => {
    if (!settingsQuery.data || validationError) return
    await updateSettings.mutateAsync({
      day_minutes: Math.round(Number(dayHours) * 60),
      quotas: settingsQuery.data.quotas.map((quota) => ({
        leave_type: quota.leave_type,
        annual_quota_minutes: unlimited[quota.leave_type]
          ? null
          : Math.round(Number(quotaHours[quota.leave_type]) * 60),
        is_active: true,
      })),
    })
  }

  if (settingsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />載入請假設定
        </CardContent>
      </Card>
    )
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-destructive">
          無法載入請假設定，請確認登入權限或稍後重試。
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="h-4 w-4" />每日請假時數換算
          </CardTitle>
          <CardDescription>
            目前全日請假及預設假別額度會以此數值換算；未來改為依實際班表計算後，這裡將作為無班表時的備援規則。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-sm items-center gap-3">
            <Label htmlFor="leave-day-hours" className="whitespace-nowrap">一天等於</Label>
            <Input
              id="leave-day-hours"
              type="number"
              min="1"
              max="24"
              step="0.25"
              value={dayHours}
              onChange={(event) => setDayHours(event.target.value)}
            />
            <span className="whitespace-nowrap text-sm text-muted-foreground">小時</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">非特休假別年度額度</CardTitle>
          <CardDescription>
            特休仍依到職年資計算；超出額度時系統只顯示警告，不會阻止送件。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settingsQuery.data.quotas.map((quota: LeaveQuotaSetting) => {
            const isUnlimited = !!unlimited[quota.leave_type]
            return (
              <div
                key={quota.leave_type}
                className="grid items-center gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(120px,1fr)_minmax(150px,220px)_auto]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{quota.leave_type_display}</span>
                  {quota.is_default && <Badge variant="outline">系統預設</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`${quota.leave_type_display}年度時數`}
                    type="number"
                    min="0"
                    step="0.5"
                    value={quotaHours[quota.leave_type] ?? ''}
                    disabled={isUnlimited}
                    onChange={(event) => setQuotaHours((current) => ({
                      ...current,
                      [quota.leave_type]: event.target.value,
                    }))}
                    placeholder={isUnlimited ? '不限額' : '年度時數'}
                  />
                  <span className="text-sm text-muted-foreground">小時／年</span>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={isUnlimited}
                    onChange={(event) => setUnlimited((current) => ({
                      ...current,
                      [quota.leave_type]: event.target.checked,
                    }))}
                  />
                  不限額
                </label>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-destructive">{validationError}</p>
        <Button onClick={save} disabled={!!validationError || updateSettings.isPending}>
          {updateSettings.isPending
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <Save className="mr-2 h-4 w-4" />}
          儲存請假設定
        </Button>
      </div>
    </div>
  )
}
