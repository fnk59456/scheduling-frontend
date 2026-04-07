import apiClient from '@/api/client'
import type { ShiftTemplate, ShiftRule, ShiftTemplateCreateRequest, ShiftRuleCreateRequest } from '@/types/shift'
import type { PaginatedResponse } from '@/types/api'

export const shiftTemplatesApi = {
  list: (params?: { organization?: number; is_active?: boolean; search?: string; ordering?: string }) =>
    apiClient.get<PaginatedResponse<ShiftTemplate>>('/shifts/templates/', { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<ShiftTemplate>(`/shifts/templates/${id}/`).then((r) => r.data),

  create: (data: ShiftTemplateCreateRequest) =>
    apiClient.post<ShiftTemplate>('/shifts/templates/', data).then((r) => r.data),

  update: (id: number, data: Partial<ShiftTemplateCreateRequest & { is_active: boolean }>) =>
    apiClient.patch<ShiftTemplate>(`/shifts/templates/${id}/`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/shifts/templates/${id}/`),
}

export const shiftRulesApi = {
  list: (params?: { organization?: number; rule_type?: string; is_active?: boolean; search?: string }) =>
    apiClient.get<PaginatedResponse<ShiftRule>>('/shifts/rules/', { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<ShiftRule>(`/shifts/rules/${id}/`).then((r) => r.data),

  create: (data: ShiftRuleCreateRequest) =>
    apiClient.post<ShiftRule>('/shifts/rules/', data).then((r) => r.data),

  update: (id: number, data: Partial<ShiftRuleCreateRequest & { is_active: boolean }>) =>
    apiClient.patch<ShiftRule>(`/shifts/rules/${id}/`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/shifts/rules/${id}/`),
}
