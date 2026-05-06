import type { Id } from 'convex/_generated/dataModel'
import { parseCanvasEmbedNodeData } from 'convex/canvases/validation'
import { normalizeCanvasNodeSurfaceStyleData } from '../shared/canvas-node-surface-style'
import type { CanvasNormalizedNodeSurfaceStyleData } from '../shared/canvas-node-surface-style'

export interface EmbedNodeData extends CanvasNormalizedNodeSurfaceStyleData {
  sidebarItemId?: Id<'sidebarItems'>
  lockedAspectRatio?: number
}

export function normalizeEmbedNodeData(data: unknown): EmbedNodeData {
  const parsedData = data === undefined ? null : parseCanvasEmbedNodeData(data)
  const surfaceStyle = normalizeCanvasNodeSurfaceStyleData(parsedData ?? undefined)

  return {
    sidebarItemId: parsedData?.sidebarItemId,
    lockedAspectRatio: parsedData?.lockedAspectRatio,
    ...surfaceStyle,
  }
}
