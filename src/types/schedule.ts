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
  created_at: string
  updated_at: string
}

export interface ScheduleVersionCreateRequest {
  organization: number
  branch?: number | null
  version_label: string
  version_type: ScheduleVersionType
  period_start: string
  period_end: string
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

