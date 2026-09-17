import apiClient from '@/api/client'
import type { PaginatedResponse } from '@/types/api'
import type { AuditLogDetail, AuditLogEntry, AuditLogParams } from '@/types/audit'

export const auditApi = {
  list: (params?: AuditLogParams) =>
    apiClient
      .get<PaginatedResponse<AuditLogEntry>>('/audit/logs/', { params })
      .then((response) => response.data),

  get: (id: number) =>
    apiClient
      .get<AuditLogDetail>(`/audit/logs/${id}/`)
      .then((response) => response.data),
}
