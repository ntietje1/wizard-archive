import { createCanvasNodePlacement } from '../canvas-node-modules'
import type { Id } from 'convex/_generated/dataModel'
import type {
  CanvasDocumentNode,
  CanvasPosition,
} from '~/features/canvas/types/canvas-domain-types'

const EMBED_SIZE = { width: 320, height: 240 } as const

export function createEmbedCanvasNode(
  sidebarItemId: Id<'sidebarItems'>,
  position: CanvasPosition,
): CanvasDocumentNode {
  return createCanvasNodePlacement('embed', {
    position,
    size: EMBED_SIZE,
    data: { sidebarItemId },
  }).node
}
