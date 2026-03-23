import { Loader2 } from '~/features/shared/utils/icons'
import { useTransitionOverlay } from '~/features/auth/utils/transition-overlay'

export function TransitionOverlay() {
  const message = useTransitionOverlay((s) => s.message)

  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/60 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3" aria-busy="true">
        <Loader2 className="size-6 animate-spin text-primary-foreground" />
        <p className="text-sm font-medium text-primary-foreground">{message}</p>
      </div>
    </div>
  )
}
