import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle, ChevronDown, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  complianceRulePresentations,
  isSoftViolation,
  violationPresentation,
  type IssueSeverity,
} from '@/lib/scheduleCompliance'
import type { CheckComplianceResult, ComplianceViolation, StaffingCoverage } from '@/types/schedule'

type Filter = 'all' | IssueSeverity | 'coverage'

type GroupItem = {
  id: string
  employeeName: string
  date: string
  message: string
  violation?: ComplianceViolation
  coverage?: StaffingCoverage
}

type Group = {
  key: string
  kind: IssueSeverity | 'coverage'
  title: string
  description: string
  suggestion: string
  items: GroupItem[]
}

const coverageMetadata = {
  under: {
    title: '人力不足',
    description: '已排人數低於每日班別計畫設定的需求人數。',
    suggestion: '指派工時還有餘裕的同事，或用 AI 排班補齊缺口。',
  },
  over: {
    title: '超過人數上限',
    description: '已排人數超過每日班別計畫設定的上限。',
    suggestion: '把多出來的人移到人力不足的班次，或調高這個班的上限。',
  },
  unplanned: {
    title: '未開班卻有人排班',
    description: '每日班別計畫沒有開這個班，卻有人被排進來。',
    suggestion: '到「每日班別」把這個班加進當天的計畫，或把人移到有開的班。',
  },
} as const

function coverageKind(item: StaffingCoverage) {
  if (item.source === 'unplanned') return 'unplanned' as const
  if (item.status === 'under') return 'under' as const
  return 'over' as const
}

function coverageMessage(item: StaffingCoverage) {
  if (item.source === 'unplanned') return `計畫沒開這個班，卻排了 ${item.assigned} 人`
  if (item.status === 'under') return `已排 ${item.assigned} / 需要 ${item.required_min} 人`
  return `已排 ${item.assigned} 人，超過上限 ${item.required_max ?? '未設定'}`
}

export function ComplianceResultsPanel({
  result,
  messageForViolation,
  onNavigate,
  onClose,
}: {
  result: CheckComplianceResult
  messageForViolation: (violation: ComplianceViolation) => string
  onNavigate: (date: string, kind: IssueSeverity) => void
  onClose: () => void
}) {
  const softRuleTypes = result.soft_rule_types ?? []
  const hardCount = result.violations.filter((item) => !isSoftViolation(item, softRuleTypes)).length
  const softCount = result.violations.length - hardCount
  const underCount = result.coverage.filter((item) => item.status === 'under').length
  const [filter, setFilter] = useState<Filter>(hardCount > 0 ? 'hard' : softCount > 0 ? 'soft' : 'coverage')
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    result.violations.forEach((violation, index) => {
      const kind: IssueSeverity = isSoftViolation(violation, softRuleTypes) ? 'soft' : 'hard'
      const key = `${kind}:${violation.rule}`
      const presentation = violationPresentation(violation, messageForViolation(violation))
      const group = map.get(key) ?? {
        key,
        kind,
        title: presentation.title,
        description: (complianceRulePresentations[violation.rule] ?? presentation).description,
        suggestion: presentation.suggestion,
        items: [],
      }
      group.items.push({
        id: `${key}:${index}`,
        employeeName: violation.employee_name || violation.employee_code || `員工 #${violation.employee_pk}`,
        date: violation.schedule_date,
        message: presentation.message,
        violation,
      })
      map.set(key, group)
    })
    result.coverage
      .filter((item) => item.status !== 'ok' || item.source === 'unplanned')
      .forEach((item, index) => {
        const coverageType = coverageKind(item)
        const metadata = coverageMetadata[coverageType]
        const key = `coverage:${coverageType}`
        const group = map.get(key) ?? { key, kind: 'coverage', ...metadata, items: [] }
        group.items.push({
          id: `${key}:${index}`,
          employeeName: item.shift_name || '全日',
          date: item.date,
          message: coverageMessage(item),
          coverage: item,
        })
        map.set(key, group)
      })
    const rank = { hard: 0, soft: 1, coverage: 2 }
    return [...map.values()].sort((left, right) => (
      rank[left.kind] - rank[right.kind] || right.items.length - left.items.length
    ))
  }, [messageForViolation, result.coverage, result.violations, softRuleTypes])

  const visibleGroups = filter === 'all' ? groups : groups.filter((group) => group.kind === filter)
  const totalIssues = Math.max(1, groups.reduce((sum, group) => sum + group.items.length, 0))
  const firstProblem = result.violations.find((item) => !isSoftViolation(item, softRuleTypes))
    ?? result.violations[0]

  const filterButton = (value: Filter, label: string, count: number) => (
    <Button
      key={value}
      type="button"
      size="sm"
      variant={filter === value ? 'default' : 'outline'}
      onClick={() => setFilter(value)}
    >
      {label} {count}
    </Button>
  )

  return (
    <Card className="border-destructive/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          違規提醒
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: '人力不足班次', count: underCount, value: 'coverage' as Filter },
            { label: '合規違規', count: hardCount, value: 'hard' as Filter },
            { label: '注意提醒', count: softCount, value: 'soft' as Filter },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              className={cn(
                'rounded-lg border p-3 text-left transition hover:bg-muted/50',
                item.count === 0 && 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20',
              )}
              onClick={() => setFilter(item.value)}
            >
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className={cn('mt-1 block text-2xl font-bold', item.count === 0 ? 'text-emerald-700' : 'text-foreground')}>
                {item.count === 0 ? '沒有問題' : item.count}
              </span>
            </button>
          ))}
        </div>

        {groups.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">問題類型分布</p>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {groups.map((group, index) => (
                <div
                  key={group.key}
                  className={cn(
                    group.kind === 'hard' && ['bg-rose-700', 'bg-rose-600', 'bg-rose-500'][index % 3],
                    group.kind === 'soft' && ['bg-amber-600', 'bg-amber-500', 'bg-amber-400'][index % 3],
                    group.kind === 'coverage' && ['bg-slate-600', 'bg-slate-500', 'bg-slate-400'][index % 3],
                  )}
                  style={{ width: `${Math.max(2, (group.items.length / totalIssues) * 100)}%` }}
                  title={`${group.title}：${group.items.length} 筆`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {filterButton('all', '全部', groups.reduce((sum, group) => sum + group.items.length, 0))}
          {filterButton('hard', '違規', hardCount)}
          {filterButton('soft', '提醒', softCount)}
          {filterButton('coverage', '人力', groups.filter((group) => group.kind === 'coverage').reduce((sum, group) => sum + group.items.length, 0))}
        </div>

        {visibleGroups.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle className="h-4 w-4" />這個分類沒有問題
          </div>
        ) : (
          <div className="space-y-2">
            {visibleGroups.map((group) => {
              const isOpen = openGroup === group.key
              return (
                <div key={group.key} className="overflow-hidden rounded-lg border">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                    onClick={() => setOpenGroup(isOpen ? null : group.key)}
                  >
                    <span className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      group.kind === 'hard' ? 'bg-destructive' : group.kind === 'soft' ? 'bg-amber-500' : 'bg-slate-500',
                    )} />
                    <span className="font-medium">{group.title}</span>
                    <Badge variant="secondary" className="ml-auto">{group.items.length} 筆</Badge>
                    <ChevronDown className={cn('h-4 w-4 transition', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <div className="space-y-4 border-t bg-muted/10 px-4 py-4">
                      <div className="grid gap-3 text-sm md:grid-cols-2">
                        <div><p className="text-xs font-medium text-muted-foreground">說明</p><p className="mt-1">{group.description}</p></div>
                        <div><p className="text-xs font-medium text-muted-foreground">智慧修正方向</p><p className="mt-1">{group.suggestion}</p></div>
                      </div>
                      <div className="space-y-2">
                        {group.items.slice(0, 30).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="block w-full rounded-md border bg-background px-3 py-2 text-left text-sm hover:border-primary/50"
                            onClick={() => {
                              if (group.kind === 'coverage') return
                              onNavigate(item.date, group.kind)
                            }}
                          >
                            <span className="font-medium">{item.employeeName} · {item.date}</span>
                            <span className="mt-0.5 block text-muted-foreground">{item.message}</span>
                          </button>
                        ))}
                        {group.items.length > 30 && (
                          <p className="text-xs text-muted-foreground">
                            還有 {group.items.length - 30} 筆沒有列出；到班表用「僅看違規／提醒」逐週處理會比較快。
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>關閉</Button>
          <Button
            disabled={!firstProblem}
            onClick={() => firstProblem && onNavigate(
              firstProblem.schedule_date,
              isSoftViolation(firstProblem, softRuleTypes) ? 'soft' : 'hard',
            )}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />在班表上查看
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
