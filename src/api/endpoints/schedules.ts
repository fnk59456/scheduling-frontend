import apiClient from '@/api/client'
import type { PaginatedResponse } from '@/types/api'
import type {
  ScheduleVersion,
  ScheduleVersionCreateRequest,
  Schedule,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  ScheduleChange,
} from '@/types/schedule'

export const scheduleVersionsApi = {
  list: (params?: { organization?: number; version_type?: string; status?: string; search?: string }) =>
    apiClient.get<PaginatedResponse<ScheduleVersion>>('/schedules/versions/', { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<ScheduleVersion>(`/schedules/versions/${id}/`).then((r) => r.data),

  create: (data: ScheduleVersionCreateRequest) =>
    apiClient.post<ScheduleVersion>('/schedules/versions/', data).then((r) => r.data),

  update: (id: number, data: Partial<ScheduleVersionCreateRequest & { status: string }>) =>
    apiClient.patch<ScheduleVersion>(`/schedules/versions/${id}/`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/schedules/versions/${id}/`),

  approve: (id: number) =>
    apiClient.post<ScheduleVersion>(`/schedules/versions/${id}/approve/`, {}).then((r) => r.data),

  createDualVersions: (id: number) =>
    apiClient.post<ScheduleVersion>(`/schedules/versions/${id}/create_dual_versions/`, {}).then((r) => r.data),

  compare: (id: number, version2Id: number) =>
    apiClient
      .get(`/schedules/versions/${id}/compare/`, { params: { version2_id: version2Id } })
      .then((r) => r.data),
}

export const schedulesApi = {
  list: (params?: { version?: number; employee?: number; date_from?: string; date_to?: string }) =>
    apiClient.get<PaginatedResponse<Schedule>>('/schedules/schedules/', { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<Schedule>(`/schedules/schedules/${id}/`).then((r) => r.data),

  create: (data: ScheduleCreateRequest) =>
    apiClient.post<Schedule>('/schedules/schedules/', data).then((r) => r.data),

  update: (id: number, data: ScheduleUpdateRequest) =>
    apiClient.patch<Schedule>(`/schedules/schedules/${id}/`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/schedules/schedules/${id}/`),
}

export const scheduleChangesApi = {
  list: (params?: { schedule?: number; change_type?: string }) =>
    apiClient.get<PaginatedResponse<ScheduleChange>>('/schedules/changes/', { params }).then((r) => r.data),

  create: (data: Omit<ScheduleChange, 'id' | 'change_type_display' | 'changed_at'>) =>
    apiClient.post<ScheduleChange>('/schedules/changes/', data).then((r) => r.data),
}

