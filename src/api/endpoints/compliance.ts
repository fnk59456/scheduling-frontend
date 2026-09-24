import apiClient from '@/api/client'
import type {
  OrgComplianceSettings,
  ComplianceRuleKey,
  Holiday,
  HolidayCreateRequest,
} from '@/types/compliance'
import type { PaginatedResponse } from '@/types/api'

export const complianceSettingsApi = {
  get: () =>
    apiClient.get<OrgComplianceSettings>('/compliance/settings/').then((r) => r.data),

  update: (data: Partial<{ soft_rule_types: ComplianceRuleKey[]; weekly_closed_days: number[] }>) =>
    apiClient.patch<OrgComplianceSettings>('/compliance/settings/', data).then((r) => r.data),
}

export const holidaysApi = {
  list: (params?: { year?: number; page?: number }) =>
    apiClient.get<PaginatedResponse<Holiday>>('/compliance/holidays/', { params }).then((r) => r.data),

  create: (data: HolidayCreateRequest) =>
    apiClient.post<Holiday>('/compliance/holidays/', data).then((r) => r.data),

  update: (id: number, data: Partial<HolidayCreateRequest>) =>
    apiClient.patch<Holiday>(`/compliance/holidays/${id}/`, data).then((r) => r.data),

  delete: (id: number) => apiClient.delete(`/compliance/holidays/${id}/`),
}
