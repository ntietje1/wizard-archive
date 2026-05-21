import type { Id } from 'convex/_generated/dataModel'
import { parseCanvasEmbedNodeData } from '~/features/canvas/domain/validation'
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
    sidebarItemId: parsedData?.sidebarItemId as Id<'sidebarItems'> | undefined,
    lockedAspectRatio: parsedData?.lockedAspectRatio,
    ...surfaceStyle,
  }
}
