import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '@/api/endpoints/billing'
import type { BillingSettings, BillingEstimateRequest } from '@/types/billing'
import { toast } from '@/hooks/use-toast'

const BILLING_RATES_KEY = ['billingRates']
const BILLING_USAGE_KEY = ['billingUsage']
const BILLING_SETTINGS_KEY = ['billingSettings']

export function useBillingRates() {
  return useQuery({
    queryKey: BILLING_RATES_KEY,
    queryFn: () => billingApi.getRates(),
  })
}

export function useBillingUsage(params?: { year?: number; month?: number }) {
  return useQuery({
    queryKey: [...BILLING_USAGE_KEY, params],
    queryFn: () => billingApi.getUsage(params),
  })
}

export function useBillingSettings() {
  return useQuery({
    queryKey: BILLING_SETTINGS_KEY,
    queryFn: () => billingApi.getSettings(),
  })
}

export function useUpdateBillingSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<BillingSettings>) => billingApi.updateSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BILLING_SETTINGS_KEY })
      toast({ title: '更新成功', description: '計費設定已儲存' })
    },
    onError: () => toast({ title: '更新失敗', description: '無法更新計費設定', variant: 'destructive' }),
  })
}

export function useBillingEstimate() {
  return useMutation({
    mutationFn: (data: BillingEstimateRequest) => billingApi.estimate(data),
  })
}
