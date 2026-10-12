import type { EmployeeListItem } from '@/types/employee'

export type OvertimeType = 'regular' | 'rest_day' | 'holiday' | 'special_holiday'

export interface OvertimeRecord {
  id: number
  employee: EmployeeListItem
  attendance: number
  overtime_date: string
  overtime_type: OvertimeType
  overtime_type_display: string
  hours: string
  multiplier: string
  calculated_amount: string | null
  notes: string
  created_at: string
  updated_at: string
}
