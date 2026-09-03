import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { leavesApi } from '@/api/endpoints/leaves'
import { parseApiErrorMessage } from '@/api/errors'
import { toast } from '@/hooks/use-toast'
import type { LeaveCreateRequest, LeaveListParams, LeaveSettingsUpdate } from '@/types/leave'

export const LEAVES_KEY = ['leaves'] as const
export const LEAVE_BALANCE_KEY = ['leaveBalance'] as const
export const LEAVE_BALANCES_KEY = ['leaveBalances'] as const
export const LEAVE_SETTINGS_KEY = ['leaveSettings'] as const

function invalidateLeaveSideEffects(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: LEAVES_KEY })
  queryClient.invalidateQueries({ queryKey: LEAVE_BALANCE_KEY })
  queryClient.invalidateQueries({ queryKey: LEAVE_BALANCES_KEY })
  queryClient.invalidateQueries({ queryKey: ['schedules'] })
  queryClient.invalidateQueries({ queryKey: ['approvedScheduleTimeline'] })
}

export function useLeaveRequests(params?: LeaveListParams, options?: { enabled?: boolean; allPages?: boolean }) {
  return useQuery({
    queryKey: [...LEAVES_KEY, options?.allPages ? 'all' : 'page', params],
    queryFn: () => options?.allPages ? leavesApi.listAll(params) : leavesApi.list(params),
    enabled: options?.enabled ?? true,
  })
}

export function useLeaveRequest(id: number) {
  return useQuery({
    queryKey: [...LEAVES_KEY, id],
    queryFn: () => leavesApi.get(id),
    enabled: id > 0,
  })
}

export function useLeaveImpact(params?: { employee: number; start_date: string; end_date: string }) {
  return useQuery({
    queryKey: [...LEAVES_KEY, 'impact', params],
    queryFn: () => leavesApi.impact(params!),
    enabled: !!params?.employee && !!params.start_date && !!params.end_date && params.start_date <= params.end_date,
  })
}

export function useLeaveBalance(employee?: number, enabled = true) {
  return useQuery({
    queryKey: [...LEAVE_BALANCE_KEY, employee ?? 'self'],
    queryFn: () => leavesApi.balance(employee),
    enabled,
  })
}

export function useLeaveBalances(employee?: number, enabled = true) {
  return useQuery({
    queryKey: [...LEAVE_BALANCES_KEY, employee ?? 'self'],
    queryFn: () => leavesApi.balances(employee),
    enabled,
  })
}

export function useLeaveSettings(enabled = true) {
  return useQuery({
    queryKey: LEAVE_SETTINGS_KEY,
    queryFn: leavesApi.getSettings,
    enabled,
  })
}

export function useUpdateLeaveSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: LeaveSettingsUpdate) => leavesApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAVE_SETTINGS_KEY })
      queryClient.invalidateQueries({ queryKey: LEAVE_BALANCES_KEY })
      toast({ title: '請假設定已儲存', description: '假別額度將依新設定重新計算' })
    },
    onError: (error) => toast({
      title: '儲存失敗',
      description: parseApiErrorMessage(error, '無法更新請假設定'),
      variant: 'destructive',
    }),
  })
}

export function useCreateLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: LeaveCreateRequest) => leavesApi.create(data),
    onSuccess: (leave) => {
      invalidateLeaveSideEffects(queryClient)
      toast({
        title: leave.status === 'approved' ? '請假已登記並核准' : '請假申請已送出',
        description: `${leave.employee_name} · ${leave.start_date}～${leave.end_date}`,
      })
    },
    onError: (error) => toast({
      title: '請假登記失敗',
      description: parseApiErrorMessage(error, '無法建立請假申請'),
      variant: 'destructive',
    }),
  })
}

export function useApproveLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) => leavesApi.approve(id, { note }),
    onSuccess: () => {
      invalidateLeaveSideEffects(queryClient)
      toast({ title: '已核准請假', description: '班表與請假餘額已同步更新' })
    },
    onError: (error) => toast({
      title: '核准失敗',
      description: parseApiErrorMessage(error, '申請可能已被其他人處理，請重新整理'),
      variant: 'destructive',
    }),
  })
}

export function useRejectLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => leavesApi.reject(id, note),
    onSuccess: () => {
      invalidateLeaveSideEffects(queryClient)
      toast({ title: '已駁回請假', description: '申請狀態已更新' })
    },
    onError: (error) => toast({
      title: '駁回失敗',
      description: parseApiErrorMessage(error, '申請可能已被其他人處理，請重新整理'),
      variant: 'destructive',
    }),
  })
}

export function useCancelLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => leavesApi.cancel(id),
    onSuccess: () => {
      invalidateLeaveSideEffects(queryClient)
      toast({ title: '請假已取消', description: '受影響的班表已由後端同步還原' })
    },
    onError: (error) => toast({
      title: '取消失敗',
      description: parseApiErrorMessage(error, '這筆申請目前無法取消'),
      variant: 'destructive',
    }),
  })
}
