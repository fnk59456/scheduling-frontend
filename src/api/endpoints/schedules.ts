import apiClient from '@/api/client'
import { fetchAllPages } from '@/api/pagination'
import type { PaginatedResponse } from '@/types/api'
import type {
  ScheduleVersion,
  ScheduleVersionCreateRequest,
  Schedule,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  ScheduleChange,
  ScheduleCompareResult,
  CheckComplianceRequest,
  CheckComplianceResult,
  DeriveLegalRequest,
  DeriveLegalResult,
  ApprovedTimelineResponse,
  ScheduleDayOverviewResponse,
  ScheduleOverlapDecision,
  ScheduleOverlapDecisionType,
} from '@/types/schedule'

export const scheduleVersionsApi = {
  list: (params?: { organization?: number; version_type?: string; status?: string; search?: string; page?: number }) =>
    apiClient.get<PaginatedResponse<ScheduleVersion>>('/schedules/versions/', { params }).then((r) => r.data),

  listAll: async (params?: { organization?: number; version_type?: string; status?: string; search?: string }) => {
    const results = await fetchAllPages<ScheduleVersion>((page) =>
      scheduleVersionsApi.list({ ...params, page }),
    )
    return { count: results.length, next: null, previous: null, results } satisfies PaginatedResponse<ScheduleVersion>
  },

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

  unapprove: (id: number, reason: string) =>
    apiClient.post<ScheduleVersion>(`/schedules/versions/${id}/unapprove/`, { reason }).then((r) => r.data),

  approvedTimeline: (params: {
    organization: number
    branch?: number | 'all'
    version_type: 'legal' | 'actual'
    date_from: string
    date_to: string
  }) => apiClient
    .get<ApprovedTimelineResponse>('/schedules/versions/approved-timeline/', { params })
    .then((r) => r.data),

  createDualVersions: (id: number) =>
    apiClient.post<ScheduleVersion>(`/schedules/versions/${id}/create_dual_versions/`, {}).then((r) => r.data),

  compare: (id: number, version2Id: number) =>
    apiClient
      .get<ScheduleCompareResult>(`/schedules/versions/${id}/compare/`, {
        params: { version2_id: version2Id },
      })
      .then((r) => r.data),

  checkCompliance: (id: number, body?: CheckComplianceRequest) =>
    apiClient
      .post<CheckComplianceResult>(`/schedules/versions/${id}/check-compliance/`, body ?? {})
      .then((r) => r.data),

  deriveLegal: (bVersionId: number, body?: DeriveLegalRequest) =>
    apiClient
      .post<DeriveLegalResult>(`/schedules/versions/${bVersionId}/derive-legal/`, body ?? {})
      .then((r) => r.data),
}

export const scheduleOverlapDecisionsApi = {
  decide: (data: {
    conflict_key: string
    schedule_ids: number[]
    decision: ScheduleOverlapDecisionType
    selected_schedule_ids: number[]
    comment: string
  }) => apiClient
    .post<ScheduleOverlapDecision>('/schedules/overlap-decisions/', data)
    .then((r) => r.data),
}

type ScheduleListParams = {
  version?: number
  employee?: number
  date_from?: string
  date_to?: string
  page?: number
}

export const schedulesApi = {
  list: (params?: ScheduleListParams) =>
    apiClient.get<PaginatedResponse<Schedule>>('/schedules/schedules/', { params }).then((r) => r.data),

  /** 週視圖用：拉取篩選條件下所有分頁，避免 PAGE_SIZE=20 截斷格子。 */
  listAll: async (params?: Omit<ScheduleListParams, 'page'>) => {
    const results = await fetchAllPages<Schedule>((page) =>
      schedulesApi.list({ ...params, page }),
    )
    return { count: results.length, next: null, previous: null, results } satisfies PaginatedResponse<Schedule>
  },

  get: (id: number) =>
    apiClient.get<Schedule>(`/schedules/schedules/${id}/`).then((r) => r.data),

  create: (data: ScheduleCreateRequest) =>
    apiClient.post<Schedule>('/schedules/schedules/', data).then((r) => r.data),

  update: (id: number, data: ScheduleUpdateRequest) =>
    apiClient.patch<Schedule>(`/schedules/schedules/${id}/`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/schedules/schedules/${id}/`),

  /** 單日跨版本概覽：新增／拖曳班次前提供資訊提示，不阻擋儲存。 */
  dayOverview: (params: {
    date: string
    employee?: number
    exclude_version?: number
    include_archived?: boolean
  }) => apiClient
    .get<ScheduleDayOverviewResponse>('/schedules/day-overview/', { params })
    .then((r) => r.data),
}

export const scheduleChangesApi = {
  list: (params?: { schedule?: number; change_type?: string }) =>
    apiClient.get<PaginatedResponse<ScheduleChange>>('/schedules/changes/', { params }).then((r) => r.data),

  create: (data: Omit<ScheduleChange, 'id' | 'change_type_display' | 'changed_at'>) =>
    apiClient.post<ScheduleChange>('/schedules/changes/', data).then((r) => r.data),
}

