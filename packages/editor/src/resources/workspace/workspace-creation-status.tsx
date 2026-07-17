import type { useWorkspaceCreation } from './use-workspace-creation'

export function WorkspaceCreationStatus({
  creation,
  onCompleted,
}: {
  creation: ReturnType<typeof useWorkspaceCreation>
  onCompleted?: () => void
}) {
  const { state } = creation
  if (state.status === 'idle' || state.status === 'pending') return null

  const message =
    state.status === 'indeterminate'
      ? `Creation unresolved: ${state.reason}`
      : state.status === 'failed'
        ? `Creation failed: ${state.reason}`
        : `Creation rejected: ${state.reason}`
  const retryable =
    state.status === 'indeterminate' || (state.status === 'failed' && state.retry !== null)
  return (
    <div role="alert" className="space-y-1 px-2 py-1 text-xs">
      <p>{message}</p>
      <div className="flex gap-3">
        {retryable && (
          <button
            type="button"
            className="underline"
            onClick={() =>
              void creation.retry().then((settlement) => {
                if (settlement?.status === 'completed') onCompleted?.()
              })
            }
          >
            Try again
          </button>
        )}
        <button type="button" className="underline" onClick={creation.dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
