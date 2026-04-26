import type { Certification } from './employee'

export interface ShiftTemplate {
  id: number
  organization: number
  organization_name: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number
  overlap_minutes: number
  min_staff_count: number
  required_certifications: Certification[]
  certification_ids: number[]
  duration_hours: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ShiftRuleType = 'max_consecutive_days' | 'min_rest_hours' | 'max_weekly_hours' | 'mandatory_rest_day'

export interface ShiftRule {
  id: number
  organization: number
  organization_name: string
  name: string
  rule_type: ShiftRuleType
  rule_type_display: string
  value: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ShiftTemplateCreateRequest {
  organization: number
  name: string
  start_time: string
  end_time: string
  break_minutes?: number
  overlap_minutes?: number
  min_staff_count?: number
  certification_ids?: number[]
}

export interface ShiftRuleCreateRequest {
  organization: number
  name: string
  rule_type: ShiftRuleType
  value: Record<string, unknown>
}

// ===== 班別員工優先順序 (後端 2026-04 新增) =====

export interface ShiftEmployeePriority {
  id: number
  employee: number
  employee_name: string
  priority_rank: number // 1 = 最優先
  max_extra_shifts: number | null // null = 不限
}

// PUT 整批替換時使用的 item (不含 id / employee_name)
export interface ShiftEmployeePriorityUpdateItem {
  employee: number
  priority_rank: number
  max_extra_shifts: number | null
}
