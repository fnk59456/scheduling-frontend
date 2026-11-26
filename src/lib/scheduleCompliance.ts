import type { ComplianceViolation } from '@/types/schedule'

export type IssueSeverity = 'hard' | 'soft'

export type ScheduleIssue = {
  id: string
  severity: IssueSeverity
  title: string
  message: string
  suggestion: string
  relatedDates: string[]
}

type RulePresentation = {
  title: string
  description: string
  suggestion: string
}

const fallbackRule: RulePresentation = {
  title: '排班規則提醒',
  description: '班次不符合排班規則的設定。',
  suggestion: '檢查這個班次與相鄰班次，調整時間或人員。',
}

export const complianceRulePresentations: Record<string, RulePresentation> = {
  max_daily_hours: {
    title: '每日工時超限',
    description: '單一班次的工時超過系統設定的每日上限，需核對是否適用法令例外。',
    suggestion: '評估拆分班次或調整工作時間，確保單日工時符合適用規則。',
  },
  max_daily_total_hours: {
    title: '每日總工時超限',
    description: '同一天多個班次合計的工時超過每日上限。',
    suggestion: '把同一天的其中一班改給其他同事，或改排較短的班別。',
  },
  min_rest_hours: {
    title: '班次休息間隔不足',
    description: '相鄰兩個班次之間的休息時間低於設定的最低時數。',
    suggestion: '把後一班改成較晚開始的班別，或換給休息時間足夠的同事。',
  },
  max_weekly_hours: {
    title: '每週工時超限',
    description: '當週排定的總工時超過每週上限。',
    suggestion: '把該週其中一班改給工時還有餘裕的同事，或改排較短的班別。',
  },
  max_consecutive_days: {
    title: '連續出勤天數超限',
    description: '連續出勤的天數超過設定上限。',
    suggestion: '在連續出勤的中間安排一天休息，由其他同事補上那一班。',
  },
  weekly_rest_days: {
    title: '一例一休（每七日休息日）',
    description: '每七天要有例假與休息日：例假不可出勤，休息日出勤需員工同意並給加班費。',
    suggestion: '把這天改為休假；若屬休息日出勤，請先取得員工同意並確認加班費。',
  },
  holiday_scheduling: {
    title: '國定假日出勤',
    description: '排在國定假日的班次，工資應加倍或安排補休。',
    suggestion: '確認加倍工資或補休安排；也可以改排偏好假日班的同事。',
  },
  holiday_work_refused: {
    title: '員工不可排國定假日',
    description: '員工的排班意願設定為「不可排國定假日」，卻被排了假日班。',
    suggestion: '改派其他同事；若員工其實願意，先到員工資料調整他的假日意願。',
  },
  org_closed_day: {
    title: '機構公休日排班',
    description: '班次排在機構設定的每週固定公休日。',
    suggestion: '確認當天是否真的需要開班；不需要就移除這個班次。',
  },
  female_night_shift: {
    title: '女性夜間工作',
    description: '女性員工排在夜間時段，需符合法令要求的同意與配套。',
    suggestion: '確認已取得同意並提供必要配套，或改排其他時段。',
  },
  max_monthly_overtime_hours: {
    title: '每月加班時數超限',
    description: '當月累計的加班時數超過設定上限。',
    suggestion: '把後續的加班班次改給加班時數較少的同事。',
  },
  min_break_minutes: {
    title: '班次中間休息不足',
    description: '班次時間較長，但班別設定的中間休息時間低於規定。',
    suggestion: '到「系統設定 → 班別模板」調高這個班別的休息分鐘數。',
  },
}

function displayNumber(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Number.isInteger(parsed) ? String(parsed) : String(Math.round(parsed * 10) / 10)
}

function detailText(violation: ComplianceViolation) {
  const detail = violation.detail
  const pair = (leftKey: string, rightKey: string) => {
    const left = displayNumber(detail[leftKey])
    const right = displayNumber(detail[rightKey])
    return left !== null && right !== null ? [left, right] : null
  }

  if (violation.rule === 'max_weekly_hours') {
    const values = pair('total_hours', 'max_hours')
    return values ? `本週排定 ${values[0]} 小時，上限 ${values[1]} 小時` : ''
  }
  if (violation.rule === 'max_daily_hours' || violation.rule === 'max_daily_total_hours') {
    const values = pair('total_hours', 'max_hours')
    return values ? `當日 ${values[0]} 小時，上限 ${values[1]} 小時` : ''
  }
  if (violation.rule === 'min_rest_hours') {
    const values = pair('rest_hours', 'required_hours')
    return values ? `與前一班只隔 ${values[0]} 小時，至少要 ${values[1]} 小時` : ''
  }
  if (violation.rule === 'max_consecutive_days') {
    const values = pair('consecutive_days', 'max_days')
    return values ? `連續出勤 ${values[0]} 天，上限 ${values[1]} 天` : ''
  }
  if (violation.rule === 'weekly_rest_days') {
    const values = pair('worked_days', 'rest_days')
    return values ? `這週上班 ${values[0]} 天、休息 ${values[1]} 天` : ''
  }
  if (violation.rule === 'max_monthly_overtime_hours') {
    const values = pair('overtime_hours', 'max_overtime_hours')
    return values ? `本月加班 ${values[0]} 小時，上限 ${values[1]} 小時` : ''
  }
  if (violation.rule === 'min_break_minutes') {
    const values = pair('break_minutes', 'required_break_minutes')
    return values ? `休息 ${values[0]} 分鐘，至少要 ${values[1]} 分鐘` : ''
  }
  return ''
}

export function isSoftViolation(violation: ComplianceViolation, softRuleTypes: string[]) {
  return violation.severity === 'soft' || softRuleTypes.includes(violation.rule)
}

export function violationPresentation(
  violation: ComplianceViolation,
  baseMessage: string,
): RulePresentation & { message: string } {
  const known = complianceRulePresentations[violation.rule]
  const presentation = known ?? { ...fallbackRule, title: violation.rule_label || fallbackRule.title }
  const detail = detailText(violation)
  return {
    ...presentation,
    message: detail ? `${baseMessage}（${detail}）` : baseMessage,
  }
}

export function issueFromViolation(
  violation: ComplianceViolation,
  softRuleTypes: string[],
  baseMessage: string,
): ScheduleIssue {
  const presentation = violationPresentation(violation, baseMessage)
  return {
    id: `compliance:${violation.rule}:${violation.employee_pk}:${violation.schedule_date}:${violation.shift_template_id ?? 'all'}`,
    severity: isSoftViolation(violation, softRuleTypes) ? 'soft' : 'hard',
    title: presentation.title,
    message: presentation.message,
    suggestion: presentation.suggestion,
    relatedDates: violation.related_dates.filter((date) => date !== violation.schedule_date),
  }
}

export const immediateIssueSuggestions = {
  dailyHours: '把同一天的其中一班改給其他同事，或改排較短的班別。',
  overlap: '調整其中一個班次的時間，或改派其他同事。',
  crossVersion: '到簽核總表確認要保留的版本與班次。',
  leave: '確認請假是否需取消，否則請改派其他同事。',
  unplanned: '到「每日班別」把這個班加進當天的計畫，或把人移到有開的班。',
} as const
