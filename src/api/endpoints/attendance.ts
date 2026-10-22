import apiClient from '@/api/client'
import type { PaginatedResponse } from '@/types/api'
import type { Attendance, AttendanceCreateRequest, AttendanceUpdateRequest, AnomalyRecord } from '@/types/attendance'
import { fetchAllPages } from '@/api/pagination'

export const attendanceApi = {
  list: (params?: { employee?: number; date_from?: string; date_to?: string; anomaly?: boolean }) =>
    apiClient.get<PaginatedResponse<Attendance>>('/attendance/attendances/', { params }).then((r) => r.data),

  listAll: async (params?: { employee?: number; date_from?: string; date_to?: string; anomaly?: boolean }) => {
    const results = await fetchAllPages<Attendance>((page) =>
      apiClient
        .get<PaginatedResponse<Attendance>>('/attendance/attendances/', { params: { ...params, page } })
        .then((response) => response.data),
    )
    return { count: results.length, next: null, previous: null, results } satisfies PaginatedResponse<Attendance>
  },

  clockIn: () =>
    apiClient.post<Attendance>('/attendance/attendances/clock_in/', {}).then((r) => r.data),

  clockOut: () =>
    apiClient.post<Attendance>('/attendance/attendances/clock_out/', {}).then((r) => r.data),

  create: (data: AttendanceCreateRequest) =>
    apiClient.post<Attendance>('/attendance/attendances/', data).then((r) => r.data),

  update: (id: number, data: AttendanceUpdateRequest) =>
    apiClient.patch<Attendance>(`/attendance/attendances/${id}/`, data).then((r) => r.data),

  delete: (id: number) => apiClient.delete(`/attendance/attendances/${id}/`),
}

export const anomalyApi = {
  list: (params?: { resolved?: boolean; severity?: string }) =>
    apiClient.get<PaginatedResponse<AnomalyRecord>>('/attendance/anomalies/', { params }).then((r) => r.data),

  resolve: (id: number, notes?: string) =>
    apiClient.post<AnomalyRecord>(`/attendance/anomalies/${id}/resolve/`, { notes: notes ?? '' }).then((r) => r.data),
}

