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
  organization_name: string
  branch_name: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: UserProfile
}
