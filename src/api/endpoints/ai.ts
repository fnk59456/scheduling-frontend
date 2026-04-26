import apiClient from '@/api/client'
import type {
  AIGenerateRequest,
  AIOptimizeRequest,
  AICheckComplianceRequest,
  AIEvaluateChangeRequest,
  AIScheduleResult,
  AIScheduleAsyncResult,
  AIComplianceReport,
  AIChangeImpact,
} from '@/types/ai'

/**
 * AI 排班引擎 API
 *
 * 重要變更 (2026-04)：
 * - 原 `async: true` 參數已改為 `run_async: true`（`async` 是 JS 保留字）
 * - /ai/schedule/optimize/, /check_compliance/, /evaluate_change/ 以前回 501，現已正式實作
 * - /ai/schedule/generate/ 會自動從 DB 載入員工 availability，前端不需再手動傳入
 */
export const aiApi = {
  /**
   * 產生排班表。
   * - run_async=false (預設)：同步，回傳 AIScheduleResult
   * - run_async=true：非同步，回傳 { task_id, status: 'pending' }
   */
  generate: (data: AIGenerateRequest) =>
    apiClient
      .post<AIScheduleResult | AIScheduleAsyncResult>('/ai/schedule/generate/', data)
      .then((r) => r.data),

  /** 優化現有排班版本（不破壞既有資料，回傳新的 assignments 建議） */
  optimize: (data: AIOptimizeRequest) =>
    apiClient
      .post<AIScheduleResult>('/ai/schedule/optimize/', data)
      .then((r) => r.data),

  /** AI 合規檢查（以班表版本為單位）*/
  checkCompliance: (data: AICheckComplianceRequest) =>
    apiClient
      .post<AIComplianceReport>('/ai/schedule/check_compliance/', data)
      .then((r) => r.data),

  /**
   * 評估調班影響。
   * 建議在「調班確認」對話框送出前呼叫，顯示 violations 警告讓使用者決定是否強制執行。
   */
  evaluateChange: (data: AIEvaluateChangeRequest) =>
    apiClient
      .post<AIChangeImpact>('/ai/schedule/evaluate_change/', data)
      .then((r) => r.data),
}
