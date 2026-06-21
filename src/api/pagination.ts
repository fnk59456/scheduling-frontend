import type { PaginatedResponse } from '@/types/api'

/** 依 DRF 分頁逐頁拉取，直到 next 為 null。 */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<PaginatedResponse<T>>,
): Promise<T[]> {
  const items: T[] = []
  let page = 1

  while (true) {
    const data = await fetchPage(page)
    items.push(...data.results)
    if (!data.next) break
    page += 1
  }

  return items
}
