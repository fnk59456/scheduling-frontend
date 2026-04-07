import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi, certificationsApi } from '@/api/endpoints/employees'
import type { EmployeeCreateRequest, EmployeeUpdateRequest, ContractCreateRequest } from '@/types/employee'
import { toast } from '@/hooks/use-toast'

const EMPLOYEES_KEY = ['employees']
const CERTIFICATIONS_KEY = ['certifications']

export function useEmployees(params?: { search?: string; is_active?: boolean; organization?: number; branch?: number }) {
  return useQuery({
    queryKey: [...EMPLOYEES_KEY, params],
    queryFn: () => employeesApi.list(params),
  })
}

export function useEmployee(id: number) {
  return useQuery({
    queryKey: [...EMPLOYEES_KEY, id],
    queryFn: () => employeesApi.get(id),
    enabled: !!id,
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: EmployeeCreateRequest) => employeesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EMPLOYEES_KEY })
      toast({ title: '建立成功', description: '員工已成功建立' })
    },
    onError: () => toast({ title: '建立失敗', description: '無法建立員工', variant: 'destructive' }),
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: EmployeeUpdateRequest }) => employeesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EMPLOYEES_KEY })
      toast({ title: '更新成功', description: '員工資料已更新' })
    },
    onError: () => toast({ title: '更新失敗', description: '無法更新員工', variant: 'destructive' }),
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => employeesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EMPLOYEES_KEY })
      toast({ title: '刪除成功', description: '員工已刪除' })
    },
    onError: () => toast({ title: '刪除失敗', description: '無法刪除員工', variant: 'destructive' }),
  })
}

export function useEmployeeContracts(employeeId: number) {
  return useQuery({
    queryKey: [...EMPLOYEES_KEY, employeeId, 'contracts'],
    queryFn: () => employeesApi.getContracts(employeeId),
    enabled: !!employeeId,
  })
}

export function useAddContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, data }: { employeeId: number; data: ContractCreateRequest }) =>
      employeesApi.addContract(employeeId, data),
    onSuccess: (_, { employeeId }) => {
      qc.invalidateQueries({ queryKey: [...EMPLOYEES_KEY, employeeId] })
      toast({ title: '新增成功', description: '契約已成功新增' })
    },
    onError: () => toast({ title: '新增失敗', description: '無法新增契約', variant: 'destructive' }),
  })
}

export function useAddCertification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, certificationId }: { employeeId: number; certificationId: number }) =>
      employeesApi.addCertification(employeeId, certificationId),
    onSuccess: (_, { employeeId }) => {
      qc.invalidateQueries({ queryKey: [...EMPLOYEES_KEY, employeeId] })
      toast({ title: '新增成功', description: '證照已新增' })
    },
    onError: () => toast({ title: '新增失敗', description: '無法新增證照', variant: 'destructive' }),
  })
}

export function useRemoveCertification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, certificationId }: { employeeId: number; certificationId: number }) =>
      employeesApi.removeCertification(employeeId, certificationId),
    onSuccess: (_, { employeeId }) => {
      qc.invalidateQueries({ queryKey: [...EMPLOYEES_KEY, employeeId] })
      toast({ title: '移除成功', description: '證照已移除' })
    },
    onError: () => toast({ title: '移除失敗', description: '無法移除證照', variant: 'destructive' }),
  })
}

export function useCertifications(params?: { search?: string }) {
  return useQuery({
    queryKey: [...CERTIFICATIONS_KEY, params],
    queryFn: () => certificationsApi.list(params),
  })
}

export function useCreateCertification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; code: string; description?: string; is_required?: boolean }) =>
      certificationsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CERTIFICATIONS_KEY })
      toast({ title: '建立成功', description: '證照類型已建立' })
    },
    onError: () => toast({ title: '建立失敗', description: '無法建立證照類型', variant: 'destructive' }),
  })
}
