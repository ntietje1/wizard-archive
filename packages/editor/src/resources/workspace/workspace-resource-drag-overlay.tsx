import { createPortal } from 'react-dom'
import type { RefObject } from 'react'
import { Ban } from 'lucide-react'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import { resourceDisplayIcon } from './resource-icon'

export type WorkspaceResourceDragOverlayState = Readonly<{
  count: number
  effect: 'blocked' | 'copy' | 'move' | null
  resource: AuthorizedResourceSummary
  x: number
  y: number
}> | null

export function WorkspaceResourceDragOverlay({
  nativePreviewRef,
  state,
}: {
  nativePreviewRef: RefObject<HTMLDivElement | null>
  state: WorkspaceResourceDragOverlayState
}) {
  if (typeof document === 'undefined') return null
  const Icon = state ? resourceDisplayIcon(state.resource) : null
  return createPortal(
    <>
      <div
        ref={nativePreviewRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 size-px opacity-0"
      />
      {state && Icon && (
        <div
          aria-hidden="true"
          data-testid="resource-drag-overlay"
          className="pointer-events-none fixed left-0 top-0 z-[10000] w-fit rounded-sm border border-border bg-background px-2 py-1 text-xs shadow-lg shadow-foreground/10"
          style={{ transform: `translate(${state.x + 8}px, ${state.y + 8}px)` }}
        >
          <span className="flex items-center gap-1 whitespace-nowrap font-semibold">
            <Icon
              className="size-3 shrink-0 text-muted-foreground"
              style={{ color: state.resource.color ?? undefined }}
            />
            <span className="text-foreground">
              {state.count > 1 ? `${state.count} items` : state.resource.title}
            </span>
          </span>
          {state.effect && (
            <span
              className={`flex items-center gap-1 whitespace-nowrap ${
                state.effect === 'blocked' ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {state.effect === 'blocked' && <Ban className="size-3" />}
              {dragEffectLabel(state.effect)}
            </span>
          )}
        </div>
      )}
    </>,
    document.body,
  )
}

function dragEffectLabel(effect: NonNullable<WorkspaceResourceDragOverlayState>['effect']) {
  switch (effect) {
    case 'blocked':
      return 'Cannot drop here'
    case 'copy':
      return 'Copy'
    case 'move':
      return 'Move'
    case null:
      return ''
  }
}
