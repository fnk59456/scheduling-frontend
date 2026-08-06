export type ScheduleVersionType = 'legal' | 'actual'
export type ScheduleVersionStatus = 'draft' | 'published' | 'approved' | 'archived'

export interface ScheduleVersion {
  id: number
  organization: number
  organization_name: string
  branch: number | null
  branch_name: string | null
  version_label: string
  version_type: ScheduleVersionType
  version_type_display: string
  period_start: string
  period_end: string
  status: ScheduleVersionStatus
  status_display: string
  approved_by: number | null
  approved_at: string | null
  created_by: number | null
  schedule_count: number
  derived_from: number | null
  created_at: string
  updated_at: string
}

export interface ScheduleVersionCreateRequest {
  organization: number
  branch?: number | null
  version_label: string
  version_type: ScheduleVersionType
  period_start?: string
  period_end?: string
}

export type ScheduleStatus = 'draft' | 'assigned' | 'confirmed' | 'completed' | 'cancelled'

export interface ScheduleEmployeeLite {
  id: number
  employee_id: string
  user_name: string
  user_email: string
  position: string
  branch_name: string
  is_active: boolean
}

export interface ScheduleShiftTemplateLite {
  id: number
  name: string
  start_time: string
  end_time: string
  duration_hours: number
}

export interface Schedule {
  id: number
  schedule_version: number
  employee: ScheduleEmployeeLite
  shift_template: ScheduleShiftTemplateLite
  schedule_date: string
  expected_hours: string
  status: ScheduleStatus
  status_display: string
  notes: string
  created_at: string
  updated_at: string
}

export interface ScheduleCreateRequest {
  schedule_version: number
  employee: number
  shift_template: number
  schedule_date: string
  expected_hours?: number
  status?: ScheduleStatus
  notes?: string
}

export interface ScheduleUpdateRequest {
  employee?: number
  shift_template?: number
  schedule_date?: string
  expected_hours?: number
  status?: ScheduleStatus
  notes?: string
}

export type ScheduleChangeType = 'substitute' | 'split' | 'transfer' | 'cancel' | 'modify'

export interface ScheduleChange {
  id: number
  schedule: number
  change_type: ScheduleChangeType
  change_type_display: string
  original_employee: number | null
  replacement_employee: number | null
  reason: string
  changed_by: number | null
  changed_at: string
  approved_by: number | null
  approved_at: string | null
}

export type ScheduleOverlapDecisionType = 'select' | 'coexist'

export interface ScheduleOverlapDecision {
  id: number
  conflict_key: string
  organization: number
  branch: number | null
  version_type: ScheduleVersionType
  employee: number
  schedule_date: string
  schedule_ids: number[]
  decision: ScheduleOverlapDecisionType
  selected_schedule_ids: number[]
  comment: string
  decided_by: number | null
  decided_by_name: string
  decided_at: string
  created_at: string
}

export interface ApprovedTimelineConflict {
  conflict_key: string
  starts_at: string
  ends_at: string
  employee_id: number
  schedule_ids: number[]
  schedules: Schedule[]
  decision: ScheduleOverlapDecision | null
}

export interface ApprovedTimelineResponse {
  versions: ScheduleVersion[]
  schedules: Schedule[]
  conflicts: ApprovedTimelineConflict[]
  unresolved_conflict_count: number
}

// ===== 合規檢查 (POST /schedules/versions/{id}/check-compliance/) =====

export type ComplianceSeverity = 'hard' | 'soft'

export interface ComplianceViolation {
  rule: string
  rule_label: string
  severity: ComplianceSeverity
  employee_pk: number
  employee_code: string
  employee_name: string
  schedule_date: string
  shift_template_id: number | null
  related_dates: string[]
  detail: Record<string, unknown>
}

export interface CheckComplianceRequest {
  rules?: Record<string, number>
  soft_rule_types?: string[]
}

export interface CheckComplianceResult {
  schedule_version_id: number
  rules_applied: Record<string, number>
  soft_rule_types: string[]
  total_count: number
  summary_by_rule: Record<string, number>
  violations: ComplianceViolation[]
}

// ===== 派生 A (POST /schedules/versions/{B_id}/derive-legal/) =====

export interface DeriveLegalRequest {
  today?: string
  time_decay_n?: number
  drift_weight?: number
  constraints?: Record<string, number>
  soft_rule_types?: string[]
  label?: string
  consume_token?: boolean
}

export interface DeriveLegalDiffSummary {
  cells_in_b: number
  cells_in_a: number
  cells_unchanged: number
  cells_removed_from_b: number
  cells_added_in_a: number
}

export interface DeriveLegalCellDiff {
  employee_id: number
  date: string
  shift_id: number
}

export interface DeriveLegalBilling {
  billing_mode: string
  tokens_charged: number
  period_usage_after: number
}

export interface DeriveLegalResult {
  legal_version_id: number
  derived_from_id: number
  diff_summary: DeriveLegalDiffSummary
  removed_cells: DeriveLegalCellDiff[]
  added_cells: DeriveLegalCellDiff[]
  billing?: DeriveLegalBilling
}

// 402 月度上限已滿
export interface BillingCapExceededError {
  error: string
  billing_mode?: string
  tokens_required?: number
  current_period_tokens?: number
  projected_period_tokens?: number
  monthly_cap_tokens?: number
}

// ===== 版本比對 (後端 2026-04 修正：differences 從永遠空陣列 → 真實差異) =====
// 同 (employee_id, schedule_date, shift_template_id) 下，
// expected_hours / status / notes 不同時會出現在 differences 陣列。

export interface ScheduleDifference {
  key: string // "employeeId_date_shiftTemplateId"
  version1: Schedule
  version2: Schedule
}

export interface ScheduleCompareResult {
  version1: ScheduleVersion
  version2: ScheduleVersion
  only_in_version1: string[]
  only_in_version2: string[]
  differences: ScheduleDifference[]
}

