import { useQuery } from '@tanstack/react-query'

import { auditApi } from '@/api/endpoints/audit'
import type { AuditLogParams } from '@/types/audit'

const AUDIT_LOGS_KEY = ['auditLogs']

export function useAuditLogs(params?: AuditLogParams) {
  return useQuery({
    queryKey: [...AUDIT_LOGS_KEY, params],
    queryFn: () => auditApi.list(params),
  })
}

export function useAuditLogDetail(id: number | null) {
  return useQuery({
    queryKey: [...AUDIT_LOGS_KEY, 'detail', id],
    queryFn: () => auditApi.get(id as number),
    enabled: id !== null,
  })
}
