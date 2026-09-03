import type { Schedule } from '@/types/schedule'

export type LeaveType =
  | 'annual'
  | 'sick'
  | 'personal'
  | 'menstrual'
  | 'marriage'
  | 'bereavement'
  | 'maternity'
  | 'paternity'
  | 'official'
  | 'other'

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type LeaveSubmissionSource = 'self' | 'manager_proxy' | 'system'
export type LeaveRequestUnit = 'full_day' | 'time_range'

export interface AffectedScheduleSnapshot {
  id: number
  prev_status: string
}

export interface LeaveRequest {
  id: number
  organization: number
  employee: number
  employee_code: string
  employee_name: string
  leave_type: LeaveType
  leave_type_display: string
  start_date: string
  end_date: string
  request_unit: LeaveRequestUnit
  start_time: string | null
  end_time: string | null
  total_days: number
  reason: string
  status: LeaveStatus
  status_display: string
  submission_source: LeaveSubmissionSource
  created_by: number | null
  created_by_name: string
  reviewed_by: number | null
  reviewed_by_name: string
  reviewed_at: string | null
  review_note: string
  affected_schedule_ids: AffectedScheduleSnapshot[]
  created_at: string
  updated_at: string
}

export interface LeaveCreateRequest {
  employee: number
  leave_type: LeaveType
  start_date: string
  end_date: string
  reason?: string
}

export interface LeaveListParams {
  status?: LeaveStatus
  employee?: number
  date_from?: string
  date_to?: string
}

export interface LeaveImpact {
  employee: number
  start_date: string
  end_date: string
  affected_count: number
  overlap_minutes: number | null
  daily_breakdown: Array<{
    date: string
    scheduled_minutes: number
    leave_minutes: number
  }>
  schedules: Schedule[]
}

export interface AnnualLeaveBalance {
  employee: number
  hire_date: string
  as_of: string
  entitlement_year_start: string | null
  entitlement_year_end: string | null
  entitled_days: number
  used_days: number
  remaining_days: number
}

export interface LeaveReviewRequest {
  note?: string
}

export interface LeaveBalanceItem {
  leave_type: LeaveType
  leave_type_display: string
  entitled_minutes: number | null
  used_minutes: number
  pending_minutes: number
  remaining_minutes: number | null
}

export interface LeaveBalancesResponse {
  employee: number
  as_of: string
  day_minutes: number
  entitlement_year_start: string | null
  entitlement_year_end: string | null
  balances: LeaveBalanceItem[]
}

export interface LeaveQuotaSetting {
  leave_type: Exclude<LeaveType, 'annual'>
  leave_type_display: string
  annual_quota_minutes: number | null
  is_default: boolean
}

export interface LeaveSettings {
  organization: number
  day_minutes: number
  quotas: LeaveQuotaSetting[]
}

export interface LeaveSettingsUpdate {
  day_minutes?: number
  quotas?: Array<{
    leave_type: Exclude<LeaveType, 'annual'>
    annual_quota_minutes: number | null
    is_active?: boolean
  }>
}

export const LEAVE_TYPE_OPTIONS: ReadonlyArray<{ value: LeaveType; label: string }> = [
  { value: 'annual', label: '特休' },
  { value: 'sick', label: '病假' },
  { value: 'personal', label: '事假' },
  { value: 'menstrual', label: '生理假' },
  { value: 'marriage', label: '婚假' },
  { value: 'bereavement', label: '喪假' },
  { value: 'maternity', label: '產假' },
  { value: 'paternity', label: '陪產假' },
  { value: 'official', label: '公假' },
  { value: 'other', label: '其他' },
]
