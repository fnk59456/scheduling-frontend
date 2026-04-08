import apiClient from '@/api/client'
import type { PaginatedResponse } from '@/types/api'
import type { Attendance, AnomalyRecord } from '@/types/attendance'

export const attendanceApi = {
  list: (params?: { employee?: number; date_from?: string; date_to?: string; anomaly?: boolean }) =>
    apiClient.get<PaginatedResponse<Attendance>>('/attendance/attendances/', { params }).then((r) => r.data),

  clockIn: () =>
    apiClient.post<Attendance>('/attendance/attendances/clock_in/', {}).then((r) => r.data),

  clockOut: () =>
    apiClient.post<Attendance>('/attendance/attendances/clock_out/', {}).then((r) => r.data),
}

export const anomalyApi = {
  list: (params?: { resolved?: boolean; severity?: string }) =>
    apiClient.get<PaginatedResponse<AnomalyRecord>>('/attendance/anomalies/', { params }).then((r) => r.data),

  resolve: (id: number, notes?: string) =>
    apiClient.post<AnomalyRecord>(`/attendance/anomalies/${id}/resolve/`, { notes: notes ?? '' }).then((r) => r.data),
}

