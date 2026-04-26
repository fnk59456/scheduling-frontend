// AI 排班引擎相關型別 (後端 2026-04 擴充)
// 對應 /api/ai/schedule/* 端點

export interface AIScheduleAssignment {
  employee_id: number
  date: string
  shift_id: number
  shift_name?: string
}

export interface AIScheduleViolation {
  type: string
  employee_id?: number | string
  message: string
  [key: string]: unknown
}

export interface AIScheduleResult {
  success: boolean
  assignments: AIScheduleAssignment[]
  score: number | null
  violations: AIScheduleViolation[]
  metadata: Record<string, unknown>
  message?: string | null
}

// 非同步回傳 (202 Accepted)
export interface AIScheduleAsyncResult {
  task_id: string
  status: 'pending'
  message: string
}

export function isAsyncResult(
  r: AIScheduleResult | AIScheduleAsyncResult,
): r is AIScheduleAsyncResult {
  return typeof (r as AIScheduleAsyncResult).task_id === 'string'
}

// ----- Generate -----

export interface AIGenerateConstraints {
  max_weekly_hours?: number
  min_rest_hours?: number
  max_consecutive_days?: number
  // 手動指定員工不可用日期：{ "<employee_id>": ["YYYY-MM-DD", ...] }
  employee_unavailability?: Record<string, string[]>
  [key: string]: unknown
}

export interface AIGenerateRequest {
  organization_id: number
  branch_id?: number | null
  period_start: string
  period_end: string
  employee_ids?: number[]
  shift_template_ids?: number[]
  constraints?: AIGenerateConstraints
  preferences?: Record<string, unknown>
  // 注意：原 `async` 已於 2026-04 後端版本重新命名為 `run_async`
  run_async?: boolean
}

// ----- Optimize -----

export interface AIOptimizeRequest {
  schedule_version_id: number
  constraints?: AIGenerateConstraints
  run_async?: boolean
}

// ----- Compliance Check -----

export interface AIComplianceReport {
  is_compliant: boolean
  violations: AIScheduleViolation[]
  warnings: AIScheduleViolation[]
  details: {
    total_assignments?: number
    employees_checked?: number
    [key: string]: unknown
  }
}

export interface AICheckComplianceRequest {
  schedule_version_id: number
  constraints?: AIGenerateConstraints
}

// ----- Evaluate Change -----

export type AIProposedChangeType = 'substitute' | 'cancel' | 'modify'

export interface AIProposedChange {
  type: AIProposedChangeType
  employee_id: number
  date: string
  shift_id: number
  new_employee_id?: number // substitute 必填
  new_shift_id?: number // modify 選填
  new_date?: string // modify 選填
}

export interface AIEvaluateChangeRequest {
  schedule_version_id: number
  proposed_change: AIProposedChange
}

export interface AIChangeImpact {
  can_apply: boolean
  impact_score: number
  violations: AIScheduleViolation[]
  warnings: AIScheduleViolation[]
  affected_employees: number[]
}
