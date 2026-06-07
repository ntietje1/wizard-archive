import { MapPinned } from 'lucide-react'
import { CanvasPreviewNodeFrame } from '~/features/canvas/components/canvas-preview-node-frame'
import { normalizeEmbedNodeData } from '~/features/canvas/nodes/embed/embed-node-data'
import {
  getCanvasNodeSurfaceStyle,
  getCanvasNodeTextStyle,
} from '~/features/canvas/nodes/shared/canvas-node-surface-style'
import type { CanvasNodeComponentProps } from '~/features/canvas/nodes/canvas-node-types'
import type { EmbedNodeData } from '~/features/canvas/nodes/embed/embed-node-data'

export function DemoCanvasEmbedRenderer({
  data,
  dragging,
}: CanvasNodeComponentProps<EmbedNodeData>) {
  const normalizedData = normalizeEmbedNodeData(data)

  return (
    <CanvasPreviewNodeFrame nodeType="embed" dragging={!!dragging}>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-lg p-4"
        style={{
          ...getCanvasNodeSurfaceStyle(normalizedData),
          ...getCanvasNodeTextStyle(normalizedData),
        }}
      >
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <MapPinned className="size-4" aria-hidden={true} />
          Harbor District Map
        </div>
        <div className="mt-3 grid flex-1 grid-cols-4 gap-2">
          <div className="rounded bg-primary/15" />
          <div className="col-span-2 rounded bg-muted" />
          <div className="rounded bg-primary/10" />
          <div className="col-span-3 rounded bg-muted/65" />
          <div className="rounded bg-primary/20" />
          <div className="rounded bg-muted/65" />
          <div className="col-span-3 rounded bg-primary/10" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Pins mark the warehouse entrance, watcher post, and escape route.
        </p>
      </div>
    </CanvasPreviewNodeFrame>
  )
}
