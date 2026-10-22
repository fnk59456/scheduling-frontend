export type RoleName = 'admin' | 'manager' | 'supervisor' | 'employee'

export interface Role {
  id: number
  name: RoleName
  description: string
  permissions: Record<string, boolean>
}

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  firebase_uid: string
  role: Role | null
  role_id: number | null
  organization: number | null
  branch: number | null
  phone: string
  is_active: boolean
  date_joined: string
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  phone: string
  role_name: string
  organization: number | null
  organization_name: string | null
  branch: number | null
  branch_name: string | null
  employee_pk: number | null
  employee_code: string | null
  firebase_linked: boolean
}

export interface LoginRequest {
  username?: string
  email?: string
  password: string
}

export interface LoginResponse {
  token: string
  user: UserProfile
}

export interface RegistrationCodeRequest {
  email: string
}

export interface RegistrationCodeResponse {
  message: string
  email: string
  expires_in_seconds: number
  cooldown_seconds: number
  debug_code?: string
}

export interface RegisterRequest {
  email: string
  code: string
  password: string
  first_name?: string
  last_name?: string
  phone?: string
}
