import type { ResourceId } from '../../resources/domain-id'
import { Loader2 } from 'lucide-react'
import { useEmbeddedCanvasState } from '../../canvas/embedded-canvas-state-context'
import type { EmbeddedCanvasState } from '../../canvas/embedded-state-contract'
import { CanvasThumbnailPreview } from '../../canvas/preview/canvas-thumbnail-preview'
import { CanvasReadOnlyPreview } from '../../canvas/preview/read-only-preview'

const MAX_ZOOM = 4
const MIN_ZOOM = 0.01
const FIT_PADDING = 0.12

export function EmbeddedCanvasContent({
  canvasId,
  previewUrl,
  alt,
}: {
  canvasId: ResourceId
  previewUrl: string | null
  alt: string
}) {
  const state = useEmbeddedCanvasState(canvasId)

  return (
    <ResolvedEmbeddedCanvasContent
      canvasId={canvasId}
      state={state}
      previewUrl={previewUrl}
      alt={alt}
    />
  )
}

function ResolvedEmbeddedCanvasContent({
  alt,
  canvasId,
  previewUrl,
  state,
}: {
  alt: string
  canvasId: ResourceId
  previewUrl: string | null
  state: EmbeddedCanvasState
}) {
  if (state.status === 'loading') {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        <span className="sr-only">Loading embedded canvas</span>
      </div>
    )
  }

  if (state.status === 'unavailable') {
    return <CanvasThumbnailPreview previewUrl={previewUrl} alt={alt} />
  }

  return (
    <div
      className="h-full w-full min-h-0 min-w-0 overflow-hidden"
      data-testid="embedded-canvas-root"
    >
      <CanvasReadOnlyPreview
        nodes={state.nodes}
        edges={state.edges}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        fitPadding={FIT_PADDING}
        className="pointer-events-none relative h-full w-full min-h-0 min-w-0"
        sourceItemId={canvasId}
      />
    </div>
  )
}
