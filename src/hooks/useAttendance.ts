import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { attendanceApi } from '@/api/endpoints/attendance'
import { toast } from '@/hooks/use-toast'

const ATTENDANCE_KEY = ['attendances']

export function useAttendances(params?: { employee?: number; date_from?: string; date_to?: string; anomaly?: boolean }) {
  return useQuery({
    queryKey: [...ATTENDANCE_KEY, params],
    queryFn: () => attendanceApi.list(params),
  })
}

export function useClockIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => attendanceApi.clockIn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ATTENDANCE_KEY })
      toast({ title: '打卡成功', description: '已完成上班打卡' })
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || '無法上班打卡'
      toast({ title: '打卡失敗', description: msg, variant: 'destructive' })
    },
  })
}

export function useClockOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => attendanceApi.clockOut(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ATTENDANCE_KEY })
      toast({ title: '打卡成功', description: '已完成下班打卡' })
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || '無法下班打卡'
      toast({ title: '打卡失敗', description: msg, variant: 'destructive' })
    },
  })
}

