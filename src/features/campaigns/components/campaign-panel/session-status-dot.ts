export function getSessionStatusDotColor({
  hasActiveSession,
  isLoadingSessions,
}: {
  hasActiveSession: boolean
  isLoadingSessions: boolean
}) {
  if (isLoadingSessions) return 'bg-feedback-loading/60'
  if (hasActiveSession) return 'bg-feedback-success'
  return 'bg-muted/30'
}
