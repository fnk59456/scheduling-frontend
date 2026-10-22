import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { attendanceApi } from '@/api/endpoints/attendance'
import { toast } from '@/hooks/use-toast'
import { parseApiErrorMessage } from '@/api/errors'
import type { AttendanceCreateRequest, AttendanceUpdateRequest } from '@/types/attendance'

const ATTENDANCE_KEY = ['attendances']

export function useAttendances(
  params?: { employee?: number; date_from?: string; date_to?: string; anomaly?: boolean },
  options?: { enabled?: boolean; allPages?: boolean },
) {
  return useQuery({
    queryKey: [...ATTENDANCE_KEY, options?.allPages ? 'all' : 'page', params],
    queryFn: () => options?.allPages ? attendanceApi.listAll(params) : attendanceApi.list(params),
    enabled: options?.enabled ?? true,
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

export function useCreateAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AttendanceCreateRequest) => attendanceApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ATTENDANCE_KEY })
      toast({ title: '出勤已建立', description: '工時與異常狀態已由後端重新計算。' })
    },
    onError: (error) => toast({
      title: '建立失敗',
      description: parseApiErrorMessage(error, '無法建立出勤紀錄'),
      variant: 'destructive',
    }),
  })
}

export function useUpdateAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AttendanceUpdateRequest }) => attendanceApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ATTENDANCE_KEY })
      toast({ title: '出勤已更新' })
    },
    onError: (error) => toast({
      title: '更新失敗',
      description: parseApiErrorMessage(error, '無法更新出勤紀錄'),
      variant: 'destructive',
    }),
  })
}

export function useDeleteAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => attendanceApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ATTENDANCE_KEY })
      toast({ title: '出勤已刪除' })
    },
    onError: (error) => toast({
      title: '刪除失敗',
      description: parseApiErrorMessage(error, '無法刪除出勤紀錄'),
      variant: 'destructive',
    }),
  })
}

