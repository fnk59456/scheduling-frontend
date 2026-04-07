import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { organizationsApi, branchesApi } from '@/api/endpoints/organizations'
import type { OrganizationCreateRequest, BranchCreateRequest } from '@/types/organization'
import { toast } from '@/hooks/use-toast'

const ORGS_KEY = ['organizations']
const BRANCHES_KEY = ['branches']

export function useOrganizations(params?: { search?: string }) {
  return useQuery({
    queryKey: [...ORGS_KEY, params],
    queryFn: () => organizationsApi.list(params),
  })
}

export function useOrganization(id: number) {
  return useQuery({
    queryKey: [...ORGS_KEY, id],
    queryFn: () => organizationsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: OrganizationCreateRequest) => organizationsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORGS_KEY })
      toast({ title: '建立成功', description: '機構已成功建立' })
    },
    onError: () => toast({ title: '建立失敗', description: '無法建立機構', variant: 'destructive' }),
  })
}

export function useUpdateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OrganizationCreateRequest> }) => organizationsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORGS_KEY })
      toast({ title: '更新成功', description: '機構資料已更新' })
    },
    onError: () => toast({ title: '更新失敗', description: '無法更新機構', variant: 'destructive' }),
  })
}

export function useDeleteOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => organizationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORGS_KEY })
      toast({ title: '刪除成功', description: '機構已刪除' })
    },
    onError: () => toast({ title: '刪除失敗', description: '無法刪除機構', variant: 'destructive' }),
  })
}

export function useBranches(params?: { organization?: number; search?: string }) {
  return useQuery({
    queryKey: [...BRANCHES_KEY, params],
    queryFn: () => branchesApi.list(params),
  })
}

export function useCreateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BranchCreateRequest) => branchesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BRANCHES_KEY })
      qc.invalidateQueries({ queryKey: ORGS_KEY })
      toast({ title: '建立成功', description: '分店已成功建立' })
    },
    onError: () => toast({ title: '建立失敗', description: '無法建立分店', variant: 'destructive' }),
  })
}

export function useUpdateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BranchCreateRequest> }) => branchesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BRANCHES_KEY })
      toast({ title: '更新成功', description: '分店資料已更新' })
    },
    onError: () => toast({ title: '更新失敗', description: '無法更新分店', variant: 'destructive' }),
  })
}

export function useDeleteBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => branchesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BRANCHES_KEY })
      qc.invalidateQueries({ queryKey: ORGS_KEY })
      toast({ title: '刪除成功', description: '分店已刪除' })
    },
    onError: () => toast({ title: '刪除失敗', description: '無法刪除分店', variant: 'destructive' }),
  })
}
