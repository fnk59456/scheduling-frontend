import type { ShiftPlan, ShiftPlanRow, ShiftPlanTemplate, ShiftPlanWeekdayKey } from '@/types/schedule'

export const SHIFT_PLAN_WEEKDAY_KEYS: ShiftPlanWeekdayKey[] = ['0', '1', '2', '3', '4', '5', '6']
export const SHIFT_PLAN_WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

/** 以本地時區處理 YYYY-MM-DD，避免 UTC 位移造成差一天 */
export function parseIsoDate(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatIsoDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addIsoDays(value: string, days: number) {
  const date = parseIsoDate(value)
  date.setDate(date.getDate() + days)
  return formatIsoDate(date)
}

/** 後端星期鍵：'0'＝週一 … '6'＝週日 */
export function weekdayKeyOf(value: string): ShiftPlanWeekdayKey {
  return String((parseIsoDate(value).getDay() + 6) % 7) as ShiftPlanWeekdayKey
}

export function eachIsoDate(start: string, end: string) {
  const dates: string[] = []
  for (let day = start; day <= end; day = addIsoDays(day, 1)) dates.push(day)
  return dates
}

export function groupPlanRowsByDate(rows: ShiftPlanRow[]) {
  const map = new Map<string, ShiftPlanRow[]>()
  for (const row of rows) {
    map.set(row.date, [...(map.get(row.date) ?? []), row])
  }
  return map
}

export function hasShiftPlan(plan: ShiftPlan | undefined | null) {
  return (plan?.summary.rows ?? 0) > 0
}

/** 所選日期區間內是否至少有一筆計畫（AI 排班前的前端防呆） */
export function hasShiftPlanInRange(plan: ShiftPlan | undefined | null, start: string, end: string) {
  return (plan?.rows ?? []).some((row) => row.date >= start && row.date <= end)
}

/**
 * 尚未設定班別的日子數。
 * 版本建立時期間預設為建立當天，套用範本後期間只擴不縮，會在最前面留下與排班無關的空白日；
 * 因此從第一個有計畫的日子起算，只把之後真正漏設的日子（含期間被撐大的新日子）計入。
 */
export function countDaysWithoutPlan(plan: ShiftPlan | undefined | null) {
  if (!plan || plan.rows.length === 0) return 0
  const planned = new Set(plan.rows.map((row) => row.date))
  const firstPlanned = plan.rows.reduce((min, row) => (row.date < min ? row.date : min), plan.rows[0].date)
  return eachIsoDate(firstPlanned, plan.period_end).filter((day) => !planned.has(day)).length
}

/** 範本格子值：班別 id → 星期鍵 → { min, max } */
export type TemplateGrid = Record<number, Partial<Record<ShiftPlanWeekdayKey, { min: string; max: string }>>>

export function templateToGrid(template: ShiftPlanTemplate | undefined): TemplateGrid {
  const grid: TemplateGrid = {}
  for (const key of SHIFT_PLAN_WEEKDAY_KEYS) {
    for (const entry of template?.[key] ?? []) {
      const shiftId = entry.shift_template_id ?? entry.shift_template
      if (!shiftId) continue
      grid[shiftId] = {
        ...(grid[shiftId] ?? {}),
        [key]: { min: String(entry.min_staff), max: entry.max_staff == null ? '' : String(entry.max_staff) },
      }
    }
  }
  return grid
}

/** 範本為空時，從既有計畫列推出星期範本（每個星期幾取第一個有計畫的日子） */
export function rowsToTemplateGrid(rows: ShiftPlanRow[]): TemplateGrid {
  const grid: TemplateGrid = {}
  const usedKeys = new Set<ShiftPlanWeekdayKey>()
  const byDate = groupPlanRowsByDate(rows)
  for (const date of [...byDate.keys()].sort()) {
    const key = weekdayKeyOf(date)
    if (usedKeys.has(key)) continue
    usedKeys.add(key)
    for (const row of byDate.get(date) ?? []) {
      grid[row.shift_template] = {
        ...(grid[row.shift_template] ?? {}),
        [key]: { min: String(row.min_staff), max: row.max_staff == null ? '' : String(row.max_staff) },
      }
    }
  }
  return grid
}

/** 格子 → 後端範本；空白或 0 人＝那個星期幾不開該班 */
export function gridToTemplate(grid: TemplateGrid): ShiftPlanTemplate {
  const template: ShiftPlanTemplate = {}
  for (const key of SHIFT_PLAN_WEEKDAY_KEYS) {
    const entries = Object.entries(grid).flatMap(([shiftId, days]) => {
      const cell = days[key]
      const min = Number(cell?.min || 0)
      if (!cell || !Number.isFinite(min) || min <= 0) return []
      const max = cell.max === '' ? null : Number(cell.max)
      return [{ shift_template: Number(shiftId), min_staff: min, max_staff: Number.isFinite(max) ? max : null }]
    })
    template[key] = entries
  }
  return template
}

/** 找出格子中上限小於最低人數的錯誤，回傳提示文字 */
export function templateGridError(grid: TemplateGrid) {
  for (const days of Object.values(grid)) {
    for (const cell of Object.values(days)) {
      if (!cell || cell.max === '') continue
      if (Number(cell.max) < Number(cell.min || 0)) return '人數上限不可小於最低人數'
    }
  }
  return null
}
