import apiClient from '@/api/client'
import type {
  Employee, EmployeeListItem, EmployeeCreateRequest, EmployeeUpdateRequest,
  Certification, Contract, ContractCreateRequest,
  EmployeeAvailability, EmployeeAvailabilityUpdateRequest,
  EmployeeTimeSlot, EmployeeTimeSlotCreateRequest,
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

  // ===== Availability (後端 2026-04 新增) =====
  // GET: 尚未建立時後端回 204 No Content。這裡把 204 轉成 null，呼叫端可用 null 判斷是否需進入「建立模式」。
  getAvailability: (employeeId: number) =>
    apiClient
      .get<EmployeeAvailability>(`/employees/employees/${employeeId}/availability/`, {
        validateStatus: (s) => s === 200 || s === 204,
      })
      .then((r) => (r.status === 204 ? null : r.data)),

  // PUT: 整批建立/替換（含 time_slots 全量覆寫）
  putAvailability: (employeeId: number, data: EmployeeAvailabilityUpdateRequest) =>
    apiClient
      .put<EmployeeAvailability>(`/employees/employees/${employeeId}/availability/`, data)
      .then((r) => r.data),

  // PATCH: 部分更新；若不傳 time_slots 則保留現有時段
  patchAvailability: (employeeId: number, data: EmployeeAvailabilityUpdateRequest) =>
    apiClient
      .patch<EmployeeAvailability>(`/employees/employees/${employeeId}/availability/`, data)
      .then((r) => r.data),

  // 單筆新增時段 (不替換現有，適合「+ 新增」按鈕)
  addTimeSlot: (employeeId: number, data: EmployeeTimeSlotCreateRequest) =>
    apiClient
      .post<EmployeeTimeSlot>(`/employees/employees/${employeeId}/availability/time_slots/`, data)
      .then((r) => r.data),

  // 刪除單筆時段
  removeTimeSlot: (employeeId: number, slotId: number) =>
    apiClient.delete(`/employees/employees/${employeeId}/availability/time_slots/${slotId}/`),
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
