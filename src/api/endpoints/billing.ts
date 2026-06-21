import apiClient from '@/api/client'
import type { PaginatedResponse } from '@/types/api'
import type {
  BillingRateConfig,
  BillingUsageResponse,
  BillingSettings,
  BillingEstimateRequest,
  BillingEstimateResponse,
} from '@/types/billing'

export const billingApi = {
  getRates: () =>
    apiClient.get<PaginatedResponse<BillingRateConfig>>('/billing/rates/').then((r) => r.data),

  getUsage: (params?: { year?: number; month?: number }) =>
    apiClient.get<BillingUsageResponse>('/billing/usage/', { params }).then((r) => r.data),

  getSettings: () =>
    apiClient.get<BillingSettings>('/billing/settings/').then((r) => r.data),

  updateSettings: (data: Partial<BillingSettings>) =>
    apiClient.patch<BillingSettings>('/billing/settings/', data).then((r) => r.data),

  estimate: (data: BillingEstimateRequest) =>
    apiClient.post<BillingEstimateResponse>('/billing/estimate/', data).then((r) => r.data),
}
