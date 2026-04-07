import apiClient from '@/api/client'
import type {
  Employee, EmployeeListItem, EmployeeCreateRequest, EmployeeUpdateRequest,
  Certification, Contract, ContractCreateRequest,
} from '@/types/employee'
import type { PaginatedResponse } from '@/types/api'

export const employeesApi = {
  list: (params?: { search?: string; is_active?: boolean; organization?: number; branch?: number; certification?: number }) =>
    apiClient.get<PaginatedResponse<EmployeeListItem>>('/employees/employees/', { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<Employee>(`/employees/employees/${id}/`).then((r) => r.data),

  create: (data: EmployeeCreateRequest) =>
    apiClient.post<Employee>('/employees/employees/', data).then((r) => r.data),

  update: (id: number, data: EmployeeUpdateRequest) =>
    apiClient.patch<Employee>(`/employees/employees/${id}/`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/employees/employees/${id}/`),

  getContracts: (id: number) =>
    apiClient.get<Contract[]>(`/employees/employees/${id}/contracts/`).then((r) => r.data),

  addContract: (id: number, data: ContractCreateRequest) =>
    apiClient.post<Contract>(`/employees/employees/${id}/add_contract/`, data).then((r) => r.data),

  getCertifications: (id: number) =>
    apiClient.get<Certification[]>(`/employees/employees/${id}/certifications/`).then((r) => r.data),

  addCertification: (employeeId: number, certificationId: number) =>
    apiClient.post(`/employees/employees/${employeeId}/add_certification/`, { certification_id: certificationId }).then((r) => r.data),

  removeCertification: (employeeId: number, certificationId: number) =>
    apiClient.delete(`/employees/employees/${employeeId}/remove_certification/`, { data: { certification_id: certificationId } }).then((r) => r.data),
}

export const certificationsApi = {
  list: (params?: { search?: string }) =>
    apiClient.get<PaginatedResponse<Certification>>('/employees/certifications/', { params }).then((r) => r.data),

  create: (data: { name: string; code: string; description?: string; is_required?: boolean }) =>
    apiClient.post<Certification>('/employees/certifications/', data).then((r) => r.data),

  update: (id: number, data: Partial<{ name: string; code: string; description: string; is_required: boolean }>) =>
    apiClient.patch<Certification>(`/employees/certifications/${id}/`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/employees/certifications/${id}/`),
}
