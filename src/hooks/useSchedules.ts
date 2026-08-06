import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { scheduleVersionsApi, schedulesApi, scheduleChangesApi, scheduleOverlapDecisionsApi } from '@/api/endpoints/schedules'
import { parseApiErrorMessage } from '@/api/errors'
import type {
  ScheduleVersionCreateRequest,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  CheckComplianceRequest,
  DeriveLegalRequest,
  ScheduleOverlapDecisionType,
} from '@/types/schedule'
import { toast } from '@/hooks/use-toast'
import axios from 'axios'

const VERSIONS_KEY = ['scheduleVersions']
const SCHEDULES_KEY = ['schedules']
const CHANGES_KEY = ['scheduleChanges']

export function useScheduleVersions(params?: { organization?: number; version_type?: string; status?: string; search?: string }) {
  return useQuery({
    queryKey: [...VERSIONS_KEY, params],
    queryFn: () => scheduleVersionsApi.list(params),
  })
}

export function useScheduleVersion(id: number) {
  return useQuery({
    queryKey: [...VERSIONS_KEY, id],
    queryFn: () => scheduleVersionsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateScheduleVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ScheduleVersionCreateRequest) => scheduleVersionsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VERSIONS_KEY })
      toast({ title: '建立成功', description: '排班版本已建立' })
    },
    onError: (err) => toast({
      title: '建立失敗',
      description: parseApiErrorMessage(err, '無法建立排班版本'),
      variant: 'destructive',
    }),
  })
}

export function useApproveScheduleVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => scheduleVersionsApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VERSIONS_KEY })
      toast({ title: '簽核成功', description: '排班版本已簽核' })
    },
    onError: () => toast({ title: '簽核失敗', description: '無法簽核排班版本', variant: 'destructive' }),
  })
}

export function useUnapproveScheduleVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      scheduleVersionsApi.unapprove(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VERSIONS_KEY })
      qc.invalidateQueries({ queryKey: ['approvedScheduleTimeline'] })
      toast({ title: '已取消簽核', description: '版本已回到草稿狀態' })
    },
    onError: (err) => toast({
      title: '取消簽核失敗',
      description: parseApiErrorMessage(err, '無法取消簽核版本'),
      variant: 'destructive',
    }),
  })
}

export function useDecideScheduleOverlap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      conflict_key: string
      schedule_ids: number[]
      decision: ScheduleOverlapDecisionType
      selected_schedule_ids: number[]
      comment: string
    }) => scheduleOverlapDecisionsApi.decide(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvedScheduleTimeline'] })
      toast({ title: '裁決已保存', description: '簽核總表已更新' })
    },
    onError: (err) => toast({
      title: '裁決失敗',
      description: parseApiErrorMessage(err, '無法保存重疊時段裁決'),
      variant: 'destructive',
    }),
  })
}

export function useCreateDualVersions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (legalVersionId: number) => scheduleVersionsApi.createDualVersions(legalVersionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VERSIONS_KEY })
      toast({ title: '建立成功', description: '已建立實際版並複製排班' })
    },
    onError: () => toast({ title: '建立失敗', description: '無法建立雙軌版本', variant: 'destructive' }),
  })
}

export function useSchedules(params?: { version?: number; employee?: number; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: [...SCHEDULES_KEY, params],
    queryFn: () => schedulesApi.listAll(params),
    enabled: !!params?.version,
  })
}

export function useCreateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ScheduleCreateRequest) => schedulesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SCHEDULES_KEY })
      toast({ title: '新增成功', description: '已新增排班' })
    },
    onError: (err) => toast({
      title: '新增失敗',
      description: parseApiErrorMessage(err, '無法新增排班'),
      variant: 'destructive',
    }),
  })
}

export function useUpdateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ScheduleUpdateRequest }) => schedulesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SCHEDULES_KEY })
      toast({ title: '更新成功', description: '已更新排班' })
    },
    onError: (err) => toast({
      title: '更新失敗',
      description: parseApiErrorMessage(err, '無法更新排班'),
      variant: 'destructive',
    }),
  })
}

export function useDeleteSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => schedulesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SCHEDULES_KEY })
      toast({ title: '刪除成功', description: '已刪除排班' })
    },
    onError: () => toast({ title: '刪除失敗', description: '無法刪除排班', variant: 'destructive' }),
  })
}

export function useScheduleChanges(params?: { schedule?: number; change_type?: string }) {
  return useQuery({
    queryKey: [...CHANGES_KEY, params],
    queryFn: () => scheduleChangesApi.list(params),
  })
}

export function useCheckCompliance() {
  return useMutation({
    mutationFn: ({ versionId, body }: { versionId: number; body?: CheckComplianceRequest }) =>
      scheduleVersionsApi.checkCompliance(versionId, body),
    onError: () => toast({ title: '合規檢查失敗', description: '無法完成合規檢查', variant: 'destructive' }),
  })
}

export function useDeriveLegal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ bVersionId, body }: { bVersionId: number; body?: DeriveLegalRequest }) =>
      scheduleVersionsApi.deriveLegal(bVersionId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VERSIONS_KEY })
      toast({ title: '派生成功', description: '已產生法規版 (A) 班表' })
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const data = err.response?.data as Record<string, unknown> | undefined
        if (status === 402) {
          toast({ title: '用量上限已滿', description: String(data?.error ?? '月度 token 已用完，請至設定調整上限'), variant: 'destructive' })
          return
        }
        if (status === 409) {
          toast({ title: '無法產生合規班表', description: String(data?.error ?? '勞基法規則無法滿足，請調整人力或規則'), variant: 'destructive' })
          return
        }
      }
      toast({ title: '派生失敗', description: '無法派生法規版班表', variant: 'destructive' })
    },
  })
}

export function useUpdateScheduleVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ScheduleVersionCreateRequest & { status: string }> }) =>
      scheduleVersionsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VERSIONS_KEY })
    },
    onError: () => toast({ title: '更新失敗', description: '無法更新版本', variant: 'destructive' }),
  })
}

