import apiClient from '@/api/client'
import type { OrgComplianceSettings, ComplianceRuleKey } from '@/types/compliance'

export const complianceSettingsApi = {
  get: () =>
    apiClient.get<OrgComplianceSettings>('/compliance/settings/').then((r) => r.data),

  update: (data: { soft_rule_types: ComplianceRuleKey[] }) =>
    apiClient.patch<OrgComplianceSettings>('/compliance/settings/', data).then((r) => r.data),
}
