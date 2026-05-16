import { Loader2 } from 'lucide-react'
import type { SidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'

export function EmbeddedSidebarItemUnavailable({
  state,
}: {
  state: Exclude<SidebarItemAvailabilityState, { status: 'available' }>
}) {
  if (state.status === 'loading') {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        <span className="sr-only">Loading embedded item</span>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
      {state.message}
    </div>
  )
}
