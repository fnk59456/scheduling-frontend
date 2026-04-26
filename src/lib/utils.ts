import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 將浮點工時格式化為「X 小時 Y 分」。
 *
 * 後端合規引擎自 2026-04 起 `rest_hours` / `min_rest_hours` 從整數改為浮點數
 * (例如 9.75)，直接顯示不直覺，建議用此函式轉成易讀文字。
 *
 * formatHours(9.75) // '9 小時 45 分'
 * formatHours(8)    // '8 小時'
 * formatHours(null) // '-'
 */
export function formatHours(hours: number | string | null | undefined): string {
  if (hours === null || hours === undefined || hours === '') return '-'
  const n = typeof hours === 'string' ? Number(hours) : hours
  if (!Number.isFinite(n)) return '-'
  const hrs = Math.floor(n)
  const min = Math.round((n - hrs) * 60)
  // 四捨五入後 min 可能等於 60，進位處理
  if (min === 60) return `${hrs + 1} 小時`
  return min > 0 ? `${hrs} 小時 ${min} 分` : `${hrs} 小時`
}
