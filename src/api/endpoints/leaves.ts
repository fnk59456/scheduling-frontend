import apiClient from '@/api/client'
import { fetchAllPages } from '@/api/pagination'
import type { PaginatedResponse } from '@/types/api'
import type {
  AnnualLeaveBalance,
  LeaveCreateRequest,
  LeaveImpact,
  LeaveListParams,
  LeaveRequest,
  LeaveReviewRequest,
} from '@/types/leave'

export const leavesApi = {
  list: (params?: LeaveListParams) =>
    apiClient
      .get<PaginatedResponse<LeaveRequest>>('/leaves/requests/', { params })
      .then((response) => response.data),

  listAll: async (params?: LeaveListParams) => {
    const results = await fetchAllPages<LeaveRequest>((page) =>
      apiClient
        .get<PaginatedResponse<LeaveRequest>>('/leaves/requests/', {
          params: { ...params, page },
        })
        .then((response) => response.data),
    )
    return { count: results.length, next: null, previous: null, results } satisfies PaginatedResponse<LeaveRequest>
  },

  get: (id: number) =>
    apiClient.get<LeaveRequest>(`/leaves/requests/${id}/`).then((response) => response.data),

  create: (data: LeaveCreateRequest) =>
    apiClient.post<LeaveRequest>('/leaves/requests/', data).then((response) => response.data),

  approve: (id: number, data?: LeaveReviewRequest) =>
    apiClient.post<LeaveRequest>(`/leaves/requests/${id}/approve/`, data ?? {}).then((response) => response.data),

  reject: (id: number, note: string) =>
    apiClient.post<LeaveRequest>(`/leaves/requests/${id}/reject/`, { note }).then((response) => response.data),

  cancel: (id: number) =>
    apiClient.post<LeaveRequest>(`/leaves/requests/${id}/cancel/`, {}).then((response) => response.data),

  impact: (params: { employee: number; start_date: string; end_date: string }) =>
    apiClient.get<LeaveImpact>('/leaves/requests/impact/', { params }).then((response) => response.data),

  balance: (employee?: number) =>
    apiClient
      .get<AnnualLeaveBalance>('/leaves/requests/balance/', {
        params: employee ? { employee } : undefined,
      })
      .then((response) => response.data),
}
