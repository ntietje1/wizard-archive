import type { Id } from 'convex/_generated/dataModel'
import { parseCanvasEmbedNodeData } from '~/features/canvas/domain/validation'
import { normalizeCanvasNodeSurfaceStyleData } from '../shared/canvas-node-surface-style'
import { normalizeEmbedTarget } from 'shared/embeds/embedTargets'
import type { CanvasNormalizedNodeSurfaceStyleData } from '../shared/canvas-node-surface-style'
import type { EmbedTarget } from 'shared/embeds/embedTargets'

export interface EmbedNodeData extends CanvasNormalizedNodeSurfaceStyleData {
  target: EmbedTarget
  lockedAspectRatio?: number
}

export function normalizeEmbedNodeData(data: unknown): EmbedNodeData {
  const parsedData = data === undefined ? null : parseCanvasEmbedNodeData(data)
  const surfaceStyle = normalizeCanvasNodeSurfaceStyleData(parsedData ?? undefined)

  return {
    target: normalizeCanvasEmbedTarget(parsedData),
    lockedAspectRatio: parsedData?.lockedAspectRatio,
    ...surfaceStyle,
  }
}

function normalizeCanvasEmbedTarget(parsedData: ReturnType<typeof parseCanvasEmbedNodeData>) {
  if (parsedData?.target) {
    return normalizeEmbedTarget(parsedData.target)
  }

  if (parsedData?.sidebarItemId) {
    return {
      kind: 'sidebarItem' as const,
      sidebarItemId: parsedData.sidebarItemId as Id<'sidebarItems'>,
    }
  }

  return { kind: 'empty' as const }
}
