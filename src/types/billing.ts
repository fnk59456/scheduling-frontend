// Billing API 型別 — 對應 /api/billing/*

export type BillingMode = 'generate' | 'fill_gaps' | 'derive_legal'

export interface BillingRateConfig {
  id: number
  billing_mode: BillingMode
  tokens_per_call: number
  effective_from: string
}

export interface BillingPeriod {
  id: number
  period_year: number
  period_month: number
  total_tokens: number
  status: 'open' | 'closed'
}

export interface UsageRecord {
  id: number
  billing_mode: BillingMode
  tokens_charged: number
  solver_status: string
  schedule_version?: number
  user?: number
  request_metadata: Record<string, unknown>
  created_at: string
}

export interface BillingUsageResponse {
  organization_id: number
  period: BillingPeriod
  cap: number | null
  cap_pct_used: number | null
  records: UsageRecord[]
}

export interface BillingSettings {
  id: number
  organization: number
  monthly_cap_tokens: number | null
  alert_threshold_pct: number
  billing_email: string
  is_billing_enabled: boolean
}

export interface BillingEstimateRequest {
  billing_mode: BillingMode
}

export interface BillingEstimateResponse {
  billing_mode: BillingMode
  tokens_to_charge: number
  current_period_tokens: number
  projected_period_tokens: number
  monthly_cap_tokens: number | null
  would_exceed_cap: boolean
}
