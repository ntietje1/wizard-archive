import { createPortal } from 'react-dom'
import { Ban } from 'lucide-react'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { DropOutcome } from '~/features/dnd/utils/dnd-registry'
import { rejectionReasonMessage } from '~/features/dnd/utils/dnd-registry'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'

export type DragOverlayState = {
  draggedItem: AnySidebarItem
  outcome: DropOutcome | null
} | null

function DragOverlayContent({ dragState }: { dragState: DragOverlayState }) {
  if (!dragState) return null

  const { draggedItem, outcome } = dragState
  const DraggedIcon = getSidebarItemIcon(draggedItem)

  return (
    <div className="bg-background rounded-sm shadow-lg shadow-foreground/10 px-2 py-1 font-semibold flex flex-col items-start w-fit">
      <span className="flex items-center gap-1 whitespace-nowrap">
        <DraggedIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="text-foreground whitespace-nowrap text-xs">
          {draggedItem.name}
        </span>
      </span>
      {outcome?.type === 'operation' && (
        <span className="text-muted-foreground whitespace-nowrap text-xs">
          {outcome.label}
        </span>
      )}
      {outcome?.type === 'rejection' && (
        <span className="text-destructive flex items-center gap-1 whitespace-nowrap text-xs">
          <Ban className="w-3 h-3" />
          {rejectionReasonMessage(outcome.reason)}
        </span>
      )}
    </div>
  )
}

export function DragOverlayPortal({
  overlayRef,
  dragState,
}: {
  overlayRef: React.RefObject<HTMLDivElement | null>
  dragState: DragOverlayState
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={overlayRef}
      className="fixed pointer-events-none z-[10000]"
      style={{ top: 0, left: 0, display: 'none' }}
    >
      <DragOverlayContent dragState={dragState} />
    </div>,
    document.body,
  )
}
