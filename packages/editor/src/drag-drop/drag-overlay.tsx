import { createPortal } from 'react-dom'
import { AlertTriangle, Ban } from 'lucide-react'
import type { AnyItem } from '../workspace/items'
import type { DropOutcome } from './outcome'
import { rejectionReasonMessage } from './rejections'
import { getSidebarItemIcon } from '../workspace/sidebar/item-icons'

export type DragOverlayState = {
  draggedItem: AnyItem
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
      {outcome?.type === 'operation' && (rejectedItemCount ?? 0) > 0 && (
        <span className="text-feedback-warning flex items-center gap-1 whitespace-nowrap text-xs">
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
