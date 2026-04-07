import apiClient from '@/api/client'
import type { Organization, Branch, OrganizationCreateRequest, BranchCreateRequest } from '@/types/organization'
import type { PaginatedResponse } from '@/types/api'

export const organizationsApi = {
  list: (params?: { search?: string; ordering?: string }) =>
    apiClient.get<PaginatedResponse<Organization>>('/organizations/organizations/', { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<Organization>(`/organizations/organizations/${id}/`).then((r) => r.data),

  create: (data: OrganizationCreateRequest) =>
    apiClient.post<Organization>('/organizations/organizations/', data).then((r) => r.data),

  update: (id: number, data: Partial<OrganizationCreateRequest>) =>
    apiClient.patch<Organization>(`/organizations/organizations/${id}/`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/organizations/organizations/${id}/`),
}

export const branchesApi = {
  list: (params?: { organization?: number; search?: string; ordering?: string }) =>
    apiClient.get<PaginatedResponse<Branch>>('/organizations/branches/', { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<Branch>(`/organizations/branches/${id}/`).then((r) => r.data),

  create: (data: BranchCreateRequest) =>
    apiClient.post<Branch>('/organizations/branches/', data).then((r) => r.data),

  update: (id: number, data: Partial<BranchCreateRequest>) =>
    apiClient.patch<Branch>(`/organizations/branches/${id}/`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/organizations/branches/${id}/`),
}
