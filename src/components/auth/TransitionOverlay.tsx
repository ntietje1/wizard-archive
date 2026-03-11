import { Loader2 } from '~/lib/icons'
import { useTransitionOverlay } from '~/lib/transition-overlay'

export function TransitionOverlay() {
  const message = useTransitionOverlay((s) => s.message)

  if (!message) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-6 animate-spin text-white" />
        <p className="text-sm font-medium text-white">{message}</p>
      </div>
    </div>
  )
}
