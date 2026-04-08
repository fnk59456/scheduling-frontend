export interface AttendanceEmployeeLite {
  id: number
  employee_id: string
  user_name: string
  user_email: string
  position: string
  branch_name: string
  is_active: boolean
}

export interface Attendance {
  id: number
  employee: AttendanceEmployeeLite
  work_date: string
  clock_in: string | null
  clock_out: string | null
  actual_hours: string | null
  is_substitute: boolean
  substitute_for: number | null
  is_cross_branch: boolean
  cross_branch: number | null
  anomaly_flag: boolean
  anomaly_reason: string
  notes: string
  created_at: string
  updated_at: string
}

export type AnomalyType =
  | 'late'
  | 'early_leave'
  | 'no_clock_in'
  | 'no_clock_out'
  | 'overtime'
  | 'mismatch'

export type AnomalySeverity = 'low' | 'medium' | 'high'

export interface AnomalyRecord {
  id: number
  attendance: number
  anomaly_type: AnomalyType
  anomaly_type_display: string
  description: string
  severity: AnomalySeverity
  severity_display: string
  resolved: boolean
  resolved_by: number | null
  resolved_at: string | null
  resolution_notes: string
  created_at: string
}

