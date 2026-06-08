import { createCanvasNodePlacement } from '../canvas-node-modules'
import type { Id } from 'convex/_generated/dataModel'
import type { CanvasPosition } from '~/features/canvas/types/canvas-domain-types'
import type { CanvasDocumentNode } from '~/features/canvas/domain/canvas-document'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
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
  sidebarItemId: Id<'sidebarItems'>,
  position: CanvasPosition,
): CanvasDocumentNode {
  return createEmbedCanvasNode({ kind: 'sidebarItem', sidebarItemId }, position)
}
