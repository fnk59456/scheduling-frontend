function flattenApiError(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  if (Array.isArray(value)) {
    const parts = value.map(flattenApiError).filter(Boolean)
    return parts.length > 0 ? parts.join('；') : null
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['detail', 'error', 'message']) {
      const message = flattenApiError(record[key])
      if (message) return message
    }

    const parts = Object.entries(record)
      .map(([key, val]) => {
        const message = flattenApiError(val)
        return message ? `${key}: ${message}` : null
      })
      .filter(Boolean)

    return parts.length > 0 ? parts.join('；') : null
  }

  return null
}

export function parseApiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: unknown } }).response
    const message = flattenApiError(response?.data)
    if (message) return message
  }

  return fallback
}
