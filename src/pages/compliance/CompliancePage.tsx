import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, Brain, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCheckCompliance, useScheduleVersions } from '@/hooks/useSchedules'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { CheckComplianceResult, ComplianceSeverity } from '@/types/schedule'

type Filter = 'all' | ComplianceSeverity

export default function CompliancePage() {
  const navigate = useNavigate()
  const versionsQuery = useScheduleVersions()
  const checkCompliance = useCheckCompliance()
  const versions = versionsQuery.data?.results ?? []
  const [versionId, setVersionId] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [result, setResult] = useState<CheckComplianceResult | null>(null)

  useEffect(() => {
    if (versionId === null && versions.length > 0) setVersionId(versions[0].id)
  }, [versionId, versions])

  useEffect(() => {
    setResult(null)
  }, [versionId])

  const hardCount = result?.violations.filter((item) => item.severity === 'hard').length ?? 0
  const softCount = result?.violations.filter((item) => item.severity === 'soft').length ?? 0
  const filtered = useMemo(() => {
    if (!result) return []
    return filter === 'all'
      ? result.violations
      : result.violations.filter((item) => item.severity === filter)
  }, [filter, result])

  const runCheck = async () => {
    if (!versionId) return
    try {
      const nextResult = await checkCompliance.mutateAsync({ versionId })
      setResult(nextResult)
      const nextHardCount = nextResult.violations.filter((item) => item.severity === 'hard').length
      toast({
        title: nextHardCount === 0 ? '合規檢查完成' : '檢查完成',
        description: `發現 ${nextResult.total_count} 筆結果，其中 ${nextHardCount} 筆為硬性違規`,
      })
    } catch {
      // Mutation hook already shows the API error.
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">合規檢查</h1>
          <p className="mt-1 text-muted-foreground">以後端現行規則即時檢查指定排班版本</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            className="h-10 min-w-64 rounded-md border border-input bg-background px-3 text-sm"
            value={versionId ?? ''}
            onChange={(event) => setVersionId(Number(event.target.value))}
            disabled={versionsQuery.isLoading || versions.length === 0}
          >
            {versions.length === 0 && <option value="">尚無排班版本</option>}
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.version_label}｜{version.period_start}～{version.period_end}
              </option>
            ))}
          </select>
          <Button onClick={runCheck} disabled={!versionId || checkCompliance.isPending}>
            <RefreshCw className={cn('mr-2 h-4 w-4', checkCompliance.isPending && 'animate-spin')} />
            {checkCompliance.isPending ? '檢查中' : '開始檢查'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">檢查狀態</span>
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div className={cn('mt-2 text-2xl font-bold', result && hardCount === 0 ? 'text-emerald-600' : '')}>
              {!result ? '尚未檢查' : hardCount === 0 ? '硬性規則通過' : '需要處理'}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">結果依組織合規設定判定</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">硬性違規</span>
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="mt-2 text-2xl font-bold text-destructive">{hardCount}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">簽核前必須處理</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">軟性提醒</span>
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">{softCount}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">可依現場情況評估</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList>
            <TabsTrigger value="all">全部 {result?.total_count ?? 0}</TabsTrigger>
            <TabsTrigger value="hard">硬性 {hardCount}</TabsTrigger>
            <TabsTrigger value="soft">軟性 {softCount}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => navigate('/ai')}>
          <Brain className="mr-2 h-4 w-4" />詢問法規助手
        </Button>
      </div>

      {!result && (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <ShieldCheck className="h-10 w-10 opacity-40" />
            <p>選擇排班版本後開始檢查，即可查看真實合規結果。</p>
          </CardContent>
        </Card>
      )}

      {result && filtered.length === 0 && (
        <Card>
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center text-emerald-700">
            <CheckCircle2 className="h-10 w-10" />
            <p className="font-medium">此分類沒有發現違規</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((violation, index) => {
          const isHard = violation.severity === 'hard'
          const detail = Object.entries(violation.detail ?? {})
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join(' · ')
          return (
            <Card key={`${violation.rule}-${violation.employee_pk}-${violation.schedule_date}-${index}`} className={cn(isHard && 'border-l-4 border-l-destructive')}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', isHard ? 'bg-destructive/10 text-destructive' : 'bg-amber-50 text-amber-600')}>
                    {isHard ? <AlertTriangle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{violation.rule_label}</span>
                      <Badge variant="outline" className={isHard ? 'border-destructive/20 bg-destructive/10 text-destructive' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                        {isHard ? '硬性' : '軟性'}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-xs">{violation.rule}</Badge>
                      <span className="ml-auto text-xs text-muted-foreground">{violation.schedule_date}</span>
                    </div>
                    <p className="mt-2 text-sm">
                      <span className="font-medium">{violation.employee_name}</span>
                      <span className="text-muted-foreground">（{violation.employee_code}）</span>
                    </p>
                    {detail && <p className="mt-2 break-words text-xs text-muted-foreground">{detail}</p>}
                    {violation.related_dates.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">相關日期：{violation.related_dates.join('、')}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
