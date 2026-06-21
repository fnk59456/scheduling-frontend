// Compliance Settings 型別 — 對應 /api/compliance/settings/

export type ComplianceRuleKey =
  | 'max_weekly_hours'
  | 'max_consecutive_days'
  | 'min_rest_hours'
  | 'max_daily_hours'

export interface OrgComplianceSettings {
  id: number
  organization: number
  soft_rule_types: ComplianceRuleKey[]
  created_at: string
  updated_at: string
}
