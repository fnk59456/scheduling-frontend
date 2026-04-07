export interface Organization {
  id: number
  name: string
  code: string
  address: string
  phone: string
  email: string
  is_active: boolean
  branches: Branch[]
  branch_count: number
  created_at: string
  updated_at: string
}

export interface Branch {
  id: number
  organization: number
  organization_name: string
  name: string
  code: string
  address: string
  phone: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrganizationCreateRequest {
  name: string
  code: string
  address?: string
  phone?: string
  email?: string
}

export interface BranchCreateRequest {
  organization: number
  name: string
  code: string
  address?: string
  phone?: string
}
