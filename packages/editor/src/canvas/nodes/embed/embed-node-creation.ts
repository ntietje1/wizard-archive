import type { ResourceId } from '../../../resources/domain-id'
import { createCanvasNodePlacement } from '../canvas-node-modules'
import type { CanvasPosition } from '../../types/canvas-domain-types'
import type { CanvasDocumentNode } from '../../document-contract'
import type { EmbedTarget } from '../../../../../../shared/embeds/embedTargets'

const EMBED_SIZE = { width: 320, height: 240 } as const

export function createEmbedCanvasNode(
  target: EmbedTarget,
  position: CanvasPosition,
): CanvasDocumentNode {
  return createCanvasNodePlacement('embed', {
    position,
    size: EMBED_SIZE,
    data: { target },
  }).node
}

export function createResourceEmbedCanvasNode(
  resourceId: ResourceId,
  position: CanvasPosition,
): CanvasDocumentNode {
  return createEmbedCanvasNode({ kind: 'resource', resourceId }, position)
}
