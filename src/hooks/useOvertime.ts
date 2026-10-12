import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { overtimeApi, type OvertimeRecordFilters } from '@/api/endpoints/overtime'
import { parseApiErrorMessage } from '@/api/errors'
import { toast } from '@/hooks/use-toast'

const OVERTIME_KEY = ['overtime-records']

export function useOvertimeRecords(params?: OvertimeRecordFilters) {
  return useQuery({
    queryKey: [...OVERTIME_KEY, params],
    queryFn: () => overtimeApi.listAll(params),
  })
}

export function useUpdateOvertimeRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { multiplier?: string; notes?: string } }) =>
      overtimeApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OVERTIME_KEY })
      toast({ title: '調整成功', description: '加班倍率與備註已更新' })
    },
    onError: (error) => toast({
      title: '調整失敗',
      description: parseApiErrorMessage(error, '無法更新加班紀錄'),
      variant: 'destructive',
    }),
  })
}

export function useCalculateOvertime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (attendanceId: number) => overtimeApi.calculate(attendanceId),
    onSuccess: (records) => {
      queryClient.invalidateQueries({ queryKey: OVERTIME_KEY })
      toast({
        title: records.length > 0 ? '計算完成' : '無需建立加班紀錄',
        description: records.length > 0
          ? `已產生 ${records.length} 筆加班紀錄`
          : '此筆出勤沒有超出排定工時。',
      })
    },
    onError: (error) => toast({
      title: '計算失敗',
      description: parseApiErrorMessage(error, '無法從出勤紀錄計算加班'),
      variant: 'destructive',
    }),
  })
}
