import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { complianceSettingsApi, holidaysApi } from '@/api/endpoints/compliance'
import type { HolidayCreateRequest } from '@/types/compliance'
import { toast } from '@/hooks/use-toast'
import { parseApiErrorMessage } from '@/api/errors'

const SETTINGS_KEY = ['complianceSettings']
const HOLIDAYS_KEY = ['complianceHolidays']

export function useComplianceSettings(enabled = true) {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: complianceSettingsApi.get,
    enabled,
  })
}

export function useUpdateComplianceSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: complianceSettingsApi.update,
    onSuccess: (data) => {
      qc.setQueryData(SETTINGS_KEY, data)
      toast({ title: '設定已儲存' })
    },
    onError: (error) => toast({
      title: '儲存失敗',
      description: parseApiErrorMessage(error, '無法更新合規設定'),
      variant: 'destructive',
    }),
  })
}

export function useHolidays(year: number) {
  return useQuery({
    queryKey: [...HOLIDAYS_KEY, year],
    queryFn: () => holidaysApi.list({ year }),
  })
}

export function useCreateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: HolidayCreateRequest) => holidaysApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HOLIDAYS_KEY })
      toast({ title: '假日已新增' })
    },
    onError: (error) => toast({
      title: '新增失敗',
      description: parseApiErrorMessage(error, '日期可能已存在'),
      variant: 'destructive',
    }),
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: holidaysApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HOLIDAYS_KEY })
      toast({ title: '假日已刪除' })
    },
    onError: () => toast({ title: '刪除失敗', variant: 'destructive' }),
  })
}
