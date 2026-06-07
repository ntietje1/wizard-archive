import { CanvasPreviewNodeFrame } from './canvas-preview-node-frame'
import { normalizeEmbedNodeData } from '../nodes/embed/embed-node-data'
import {
  getCanvasNodeSurfaceStyle,
  getCanvasNodeTextStyle,
} from '../nodes/shared/canvas-node-surface-style'
import type { CanvasNodeComponentProps } from '../nodes/canvas-node-types'
import type { EmbedNodeData } from '../nodes/embed/embed-node-data'

const DEFAULT_EMBED_MIN_WIDTH = 240
const DEFAULT_EMBED_MIN_HEIGHT = 180

export function CanvasPreviewDefaultEmbedNode({
  data,
  dragging,
}: CanvasNodeComponentProps<EmbedNodeData>) {
  const normalizedData = normalizeEmbedNodeData(data)

  return (
    <CanvasPreviewNodeFrame nodeType="embed" dragging={!!dragging}>
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground"
        style={{
          ...getCanvasNodeSurfaceStyle(normalizedData),
          ...getCanvasNodeTextStyle(normalizedData),
          minHeight: DEFAULT_EMBED_MIN_HEIGHT,
          minWidth: DEFAULT_EMBED_MIN_WIDTH,
        }}
      >
        Embedded item preview unavailable.
      </div>
    </CanvasPreviewNodeFrame>
  )
}
