import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { scheduleVersionsApi, schedulesApi, scheduleChangesApi } from '@/api/endpoints/schedules'
import type {
  ScheduleVersionCreateRequest,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
} from '@/types/schedule'
import { toast } from '@/hooks/use-toast'

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
    onError: () => toast({ title: '建立失敗', description: '無法建立排班版本', variant: 'destructive' }),
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
    queryFn: () => schedulesApi.list(params),
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
    onError: () => toast({ title: '新增失敗', description: '無法新增排班', variant: 'destructive' }),
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
    onError: () => toast({ title: '更新失敗', description: '無法更新排班', variant: 'destructive' }),
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

