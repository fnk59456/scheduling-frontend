import { useQuery } from '@tanstack/react-query'
import { overtimeApi, type OvertimeRecordFilters } from '@/api/endpoints/overtime'

const OVERTIME_KEY = ['overtime-records']

export function useOvertimeRecords(params?: OvertimeRecordFilters) {
  return useQuery({
    queryKey: [...OVERTIME_KEY, params],
    queryFn: () => overtimeApi.listAll(params),
  })
}
