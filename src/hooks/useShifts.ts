import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { shiftTemplatesApi, shiftRulesApi } from '@/api/endpoints/shifts'
import type { ShiftTemplateCreateRequest, ShiftRuleCreateRequest } from '@/types/shift'
import { toast } from '@/hooks/use-toast'

const TEMPLATES_KEY = ['shiftTemplates']
const RULES_KEY = ['shiftRules']

export function useShiftTemplates(params?: { organization?: number; is_active?: boolean; search?: string }) {
  return useQuery({
    queryKey: [...TEMPLATES_KEY, params],
    queryFn: () => shiftTemplatesApi.list(params),
  })
}

export function useShiftTemplate(id: number) {
  return useQuery({
    queryKey: [...TEMPLATES_KEY, id],
    queryFn: () => shiftTemplatesApi.get(id),
    enabled: !!id,
  })
}

export function useCreateShiftTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ShiftTemplateCreateRequest) => shiftTemplatesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY })
      toast({ title: '建立成功', description: '班別模板已建立' })
    },
    onError: () => toast({ title: '建立失敗', description: '無法建立班別模板', variant: 'destructive' }),
  })
}

export function useUpdateShiftTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ShiftTemplateCreateRequest & { is_active: boolean }> }) =>
      shiftTemplatesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY })
      toast({ title: '更新成功', description: '班別模板已更新' })
    },
    onError: () => toast({ title: '更新失敗', description: '無法更新班別模板', variant: 'destructive' }),
  })
}

export function useDeleteShiftTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => shiftTemplatesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY })
      toast({ title: '刪除成功', description: '班別模板已刪除' })
    },
    onError: () => toast({ title: '刪除失敗', description: '無法刪除班別模板', variant: 'destructive' }),
  })
}

export function useShiftRules(params?: { organization?: number; rule_type?: string; is_active?: boolean }) {
  return useQuery({
    queryKey: [...RULES_KEY, params],
    queryFn: () => shiftRulesApi.list(params),
  })
}

export function useCreateShiftRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ShiftRuleCreateRequest) => shiftRulesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RULES_KEY })
      toast({ title: '建立成功', description: '排班規則已建立' })
    },
    onError: () => toast({ title: '建立失敗', description: '無法建立排班規則', variant: 'destructive' }),
  })
}

export function useUpdateShiftRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ShiftRuleCreateRequest & { is_active: boolean }> }) =>
      shiftRulesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RULES_KEY })
      toast({ title: '更新成功', description: '排班規則已更新' })
    },
    onError: () => toast({ title: '更新失敗', description: '無法更新排班規則', variant: 'destructive' }),
  })
}

export function useDeleteShiftRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => shiftRulesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RULES_KEY })
      toast({ title: '刪除成功', description: '排班規則已刪除' })
    },
    onError: () => toast({ title: '刪除失敗', description: '無法刪除排班規則', variant: 'destructive' }),
  })
}
