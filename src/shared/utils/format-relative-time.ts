const CLOCK_SKEW_TOLERANCE_MS = 5000

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < -CLOCK_SKEW_TOLERANCE_MS) {
    throw new Error('Timestamp cannot be in the future')
  }

  if (diff < 0) return 'Just now'

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  const date = new Date(timestamp)
  const currentYear = new Date(now).getFullYear()
  const timestampYear = date.getFullYear()

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: timestampYear !== currentYear ? 'numeric' : undefined,
  })
}
