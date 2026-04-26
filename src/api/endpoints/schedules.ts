import apiClient from '@/api/client'
import type { PaginatedResponse } from '@/types/api'
import type {
  ScheduleVersion,
  ScheduleVersionCreateRequest,
  Schedule,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  ScheduleChange,
  ScheduleCompareResult,
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

  // 後端 2026-04 修正：differences 現在會回傳真實差異（同員工同日期同班別，但
  // expected_hours / status / notes 有差異者），前端 UI 需能正確渲染。
  compare: (id: number, version2Id: number) =>
    apiClient
      .get<ScheduleCompareResult>(`/schedules/versions/${id}/compare/`, {
        params: { version2_id: version2Id },
      })
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

