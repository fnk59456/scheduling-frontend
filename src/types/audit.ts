export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'publish'
  | 'cancel'
  | string

export interface AuditLogEntry {
  id: number
  user: number | null
  user_name: string
  action: AuditAction
  action_display: string
  model_name: string
  record_id: number
  changes: Record<string, unknown> | null
  timestamp: string
}

export interface AuditLogDetail extends AuditLogEntry {
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string
}

export interface AuditLogParams {
  action?: string
  model_name?: string
  user?: number
  search?: string
  date_from?: string
  date_to?: string
  page?: number
}
