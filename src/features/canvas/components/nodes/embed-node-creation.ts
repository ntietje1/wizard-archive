import { createCanvasNode } from './canvas-node-registry'
import type { Id } from 'convex/_generated/dataModel'
import type { Node, XYPosition } from '@xyflow/react'

const EMBED_SIZE = { width: 320, height: 240 } as const

export function createEmbedCanvasNode(
  sidebarItemId: Id<'sidebarItems'>,
  position: XYPosition,
): Node {
  return createCanvasNode('embed', {
    position,
    size: EMBED_SIZE,
    data: { sidebarItemId },
  })
}
