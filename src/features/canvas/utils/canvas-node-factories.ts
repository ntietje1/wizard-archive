import { createCanvasNode, getCanvasNodeDefinition } from '../components/nodes/canvas-node-registry'
import type { Id } from 'convex/_generated/dataModel'
import type { Node, XYPosition } from '@xyflow/react'

export interface CanvasPlacementResult {
  node: Node
  startEditing: boolean
}

const EMBED_SIDEBAR_SIZE = { width: 320, height: 240 } as const
const EMBED_FILE_SIZE = { width: 200, height: 52 } as const

export function createTextNode(position: XYPosition): CanvasPlacementResult {
  return createPlacementResult('text', position)
}

export function createStickyNode(position: XYPosition): CanvasPlacementResult {
  return createPlacementResult('sticky', position)
}

export function createRectangleNode(
  rect: { x: number; y: number; width: number; height: number },
  style: { color: string; opacity: number },
): Node {
  return createCanvasNode('rectangle', {
    position: { x: rect.x, y: rect.y },
    size: { width: rect.width, height: rect.height },
    data: style,
  })
}

export function createEmbedSidebarItemNode(
  sidebarItemId: Id<'sidebarItems'>,
  position: XYPosition,
): Node {
  return createCanvasNode('embed', {
    position,
    size: EMBED_SIDEBAR_SIZE,
    data: { sidebarItemId },
  })
}

export function createEmbedFileNode(sidebarItemId: Id<'sidebarItems'>, position: XYPosition): Node {
  return createCanvasNode('embed', {
    position,
    size: EMBED_FILE_SIZE,
    data: { sidebarItemId },
  })
}

function createPlacementResult(
  type: 'text' | 'sticky',
  position: XYPosition,
): CanvasPlacementResult {
  const definition = getCanvasNodeDefinition(type)
  return {
    node: createCanvasNode(type, { position }),
    startEditing: definition.placement?.startEditingOnCreate ?? false,
  }
}
