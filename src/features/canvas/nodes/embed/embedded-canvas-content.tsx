import { Loader2 } from 'lucide-react'
import { useEmbeddedCanvasState } from './use-embedded-canvas-state'
import { CanvasThumbnailPreview } from '~/features/previews/components/canvas-thumbnail-preview'
import { CanvasPreviewEmbedNode } from '../../components/canvas-preview-embed-node'
import { CanvasReadOnlyPreview } from '../../components/canvas-read-only-preview'
import type { Id } from 'convex/_generated/dataModel'
const MAX_ZOOM = 4
const MIN_ZOOM = 0.01
const FIT_PADDING = 0.12

export function EmbeddedCanvasContent({
  canvasId,
  previewUrl,
  alt,
}: {
  nodeId: string
  canvasId: Id<'sidebarItems'>
  previewUrl: string | null
  alt: string
}) {
  const { nodes, edges, isLoading, isError } = useEmbeddedCanvasState(canvasId)

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span className="sr-only">Loading embedded canvas</span>
      </div>
    )
  }

  if (isError) {
    return <CanvasThumbnailPreview previewUrl={previewUrl} alt={alt} />
  }

  return (
    <div
      className="h-full w-full min-h-0 min-w-0 overflow-hidden"
      data-testid="embedded-canvas-root"
    >
      <CanvasReadOnlyPreview
        nodes={nodes}
        edges={edges}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        fitPadding={FIT_PADDING}
        className="pointer-events-none relative h-full w-full min-h-0 min-w-0"
        embedRenderer={CanvasPreviewEmbedNode}
        sourceItemId={canvasId}
      />
    </div>
  )
}
