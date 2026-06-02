import { createPortal } from 'react-dom'
import { AlertTriangle, Ban } from 'lucide-react'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { DropOutcome } from '~/features/dnd/utils/drop-outcome'
import { rejectionReasonMessage } from '~/features/dnd/utils/drop-rejections'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'

export type DragOverlayState = {
  draggedItem: AnySidebarItem
  draggedItemCount?: number
  outcome: DropOutcome | null
  rejectedItemCount?: number
} | null

function DragOverlayContent({ dragState }: { dragState: DragOverlayState }) {
  if (!dragState) return null

  const { draggedItem, draggedItemCount, outcome, rejectedItemCount } = dragState
  const DraggedIcon = getSidebarItemIcon(draggedItem)

  return (
    <div className="bg-background rounded-sm shadow-lg shadow-foreground/10 px-2 py-1 font-semibold flex flex-col items-start w-fit">
      <span className="flex items-center gap-1 whitespace-nowrap">
        <DraggedIcon className="size-3 text-muted-foreground flex-shrink-0" />
        <span className="text-foreground whitespace-nowrap text-xs">
          {(draggedItemCount ?? 0) > 1 ? `${draggedItemCount} items` : draggedItem.name}
        </span>
      </span>
      {outcome?.type === 'operation' && (
        <span className="text-muted-foreground whitespace-nowrap text-xs">{outcome.label}</span>
      )}
      {outcome?.type === 'operation' && rejectedItemCount && (
        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 whitespace-nowrap text-xs">
          <AlertTriangle className="size-3" aria-hidden="true" />
          {rejectedItemCount === 1
            ? '1 item cannot be included'
            : `${rejectedItemCount} items cannot be included`}
        </span>
      )}
      {outcome?.type === 'rejection' && (
        <span className="text-destructive flex items-center gap-1 whitespace-nowrap text-xs">
          <Ban className="size-3" aria-hidden="true" />
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
