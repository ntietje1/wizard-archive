import type { Id } from 'convex/_generated/dataModel'
import type { ParsedCanvasEmbedNodeData } from 'convex/canvases/validation'
import { parseCanvasEmbedNodeData } from 'convex/canvases/validation'
import { normalizeCanvasNodeSurfaceStyleData } from '../shared/canvas-node-surface-style'
import type {
  CanvasNodeSurfaceStyleData,
  CanvasNormalizedNodeSurfaceStyleData,
} from '../shared/canvas-node-surface-style'

export interface EmbedNodeData
  extends Record<string, unknown>, CanvasNormalizedNodeSurfaceStyleData {
  sidebarItemId?: Id<'sidebarItems'>
  lockedAspectRatio?: number
}

export function normalizeEmbedNodeData(
  data:
    | ParsedCanvasEmbedNodeData
    | CanvasNodeSurfaceStyleData
    | Record<string, unknown>
    | undefined,
): EmbedNodeData {
  const parsedData = data === undefined ? null : parseCanvasEmbedNodeData(data)
  const surfaceStyle = normalizeCanvasNodeSurfaceStyleData(parsedData ?? undefined)

  return {
    sidebarItemId: parsedData?.sidebarItemId,
    lockedAspectRatio: parsedData?.lockedAspectRatio,
    ...surfaceStyle,
  }
}
