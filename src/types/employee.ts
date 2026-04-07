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
