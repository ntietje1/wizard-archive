import { createPortal } from 'react-dom'
import type { RefObject } from 'react'
import { Ban } from 'lucide-react'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import { resourceDisplayIcon } from './resource-icon'

export type WorkspaceResourceDragOverlayState = Readonly<{
  count: number
  feedback: Readonly<{ blocked: boolean; label: string }> | null
  resource: AuthorizedResourceSummary
}> | null

export function WorkspaceResourceDragOverlay({
  nativePreviewRef,
  overlayRef,
  state,
}: {
  nativePreviewRef: RefObject<HTMLDivElement | null>
  overlayRef: RefObject<HTMLDivElement | null>
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
      <div
        ref={overlayRef}
        aria-hidden="true"
        data-testid="resource-drag-overlay"
        className="pointer-events-none fixed left-0 top-0 z-[10000] hidden w-fit rounded-sm border border-border bg-background px-2 py-1 text-xs shadow-lg shadow-foreground/10"
      >
        {state && Icon && (
          <>
            <span className="flex items-center gap-1 whitespace-nowrap font-semibold">
              <Icon
                className="size-3 shrink-0 text-muted-foreground"
                style={{ color: state.resource.color ?? undefined }}
              />
              <span className="text-foreground">
                {state.count > 1 ? `${state.count} items` : state.resource.title}
              </span>
            </span>
            {state.feedback && (
              <span
                className={`flex items-center gap-1 whitespace-nowrap ${
                  state.feedback.blocked ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                {state.feedback.blocked && <Ban className="size-3" />}
                {state.feedback.label}
              </span>
            )}
          </>
        )}
      </div>
    </>,
    document.body,
  )
}
