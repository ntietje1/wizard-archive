import { normalizeEmbedTarget } from '../../../../shared/embeds/embedTargets'
import { normalizeCanvasNodeSurfaceStyleData } from './node-surface-style'
import { parseCanvasEmbedNodeData } from './embed-node-data'
import type { CanvasNormalizedNodeSurfaceStyleData } from './node-surface-style'
import type { EmbedTarget } from '../../../../shared/embeds/embedTargets'

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

  return { kind: 'empty' as const }
}
