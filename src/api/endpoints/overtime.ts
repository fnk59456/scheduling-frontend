import apiClient from '@/api/client'
import { fetchAllPages } from '@/api/pagination'
import type { PaginatedResponse } from '@/types/api'
import type { OvertimeRecord } from '@/types/overtime'

export interface OvertimeRecordFilters {
  employee?: number
  date_from?: string
  date_to?: string
}

export const overtimeApi = {
  listAll: async (params?: OvertimeRecordFilters) => {
    const results = await fetchAllPages<OvertimeRecord>((page) =>
      apiClient
        .get<PaginatedResponse<OvertimeRecord>>('/overtime/records/', { params: { ...params, page } })
        .then((response) => response.data),
    )
    return { count: results.length, next: null, previous: null, results } satisfies PaginatedResponse<OvertimeRecord>
  },
}
