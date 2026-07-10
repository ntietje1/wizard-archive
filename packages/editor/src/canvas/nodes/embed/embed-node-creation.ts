import { createCanvasNodePlacement } from '../canvas-node-modules'
import type { CanvasPosition } from '../../types/canvas-domain-types'
import type { CanvasDocumentNode } from '../../document-contract'
import type { EmbedTarget } from '../../../../../../shared/embeds/embedTargets'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
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

export function createSidebarItemEmbedCanvasNode(
  sidebarItemId: SidebarItemId,
  position: CanvasPosition,
): CanvasDocumentNode {
  return createEmbedCanvasNode({ kind: 'resource', resourceId: sidebarItemId }, position)
}
