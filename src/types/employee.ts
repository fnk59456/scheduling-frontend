export interface Certification {
  id: number
  name: string
  code: string
  description: string
  is_required: boolean
  created_at: string
}

export type ContractType = 'full_time' | 'part_time' | 'dispatch'

export interface Contract {
  id: number
  employee: number
  contract_type: ContractType
  contract_type_display: string
  start_date: string
  end_date: string | null
  base_salary: string
  agreed_hours_per_week: string
  notes: string
  created_at: string
  updated_at: string
}

export interface EmployeeUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
}

export interface Employee {
  id: number
  user: EmployeeUser
  employee_id: string
  organization: number
  organization_name: string
  branch: number
  branch_name: string
  position: string
  contract_type: ContractType
  contract_type_display: string
  agreed_hours_per_week: string
  certifications: Certification[]
  certification_ids: number[]
  contracts: Contract[]
  hire_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmployeeListItem {
  id: number
  user: EmployeeUser
  user_name: string
  user_email: string
  employee_id: string
  organization: number
  organization_name: string
  branch: number
  branch_name: string
  position: string
  contract_type: ContractType
  contract_type_display: string
  certification_count: number
  hire_date: string
  is_active: boolean
}

export interface EmployeeCreateRequest {
  user: {
    username: string
    email: string
    password: string
    first_name: string
    last_name: string
  }
  employee_id: string
  organization: number
  branch: number
  position: string
  contract_type: ContractType
  agreed_hours_per_week: number
  certification_ids?: number[]
  hire_date: string
}

export interface EmployeeUpdateRequest {
  employee_id?: string
  organization?: number
  branch?: number
  position?: string
  contract_type?: ContractType
  agreed_hours_per_week?: number
  certification_ids?: number[]
  is_active?: boolean
}

export interface ContractCreateRequest {
  employee: number
  contract_type: ContractType
  start_date: string
  end_date?: string
  base_salary: number
  agreed_hours_per_week: number
  notes?: string
}

// ===== 員工可用性 / 時段設定 (後端 2026-04 新增) =====

export type SlotType = 'blocked' | 'preferred'

// 0=週一 … 6=週日；null = 每天都套用
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 | null

export interface EmployeeTimeSlot {
  id: number
  slot_type: SlotType
  slot_type_display: string
  day_of_week: DayOfWeek
  day_of_week_display: string
  start_time: string
  end_time: string
  label: string
  created_at: string
}

export interface EmployeeAvailability {
  id: number
  employee: number
  // 後端以 Decimal 序列化，回傳為字串 (例："32.00")；null = 沿用合約設定
  required_hours_per_week: string | null
  special_rules: string
  effective_from: string | null
  effective_to: string | null
  time_slots: EmployeeTimeSlot[]
  created_at: string
  updated_at: string
}

export interface EmployeeTimeSlotInput {
  slot_type: SlotType
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
  label?: string
}

// PUT 會整批替換 time_slots；PATCH 不傳 time_slots 則保留現有
export interface EmployeeAvailabilityUpdateRequest {
  required_hours_per_week?: number | string | null
  special_rules?: string
  effective_from?: string | null
  effective_to?: string | null
  time_slots?: EmployeeTimeSlotInput[]
}

export interface EmployeeTimeSlotCreateRequest extends EmployeeTimeSlotInput {}

// 下拉選單共用常數
export const DAY_OF_WEEK_OPTIONS: ReadonlyArray<{ value: DayOfWeek; label: string }> = [
  { value: null, label: '每天' },
  { value: 0, label: '週一' },
  { value: 1, label: '週二' },
  { value: 2, label: '週三' },
  { value: 3, label: '週四' },
  { value: 4, label: '週五' },
  { value: 5, label: '週六' },
  { value: 6, label: '週日' },
]
