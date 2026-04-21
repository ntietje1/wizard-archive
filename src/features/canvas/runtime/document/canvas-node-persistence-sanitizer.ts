import { stripEphemeralCanvasNodeState } from '../../utils/canvas-node-persistence'
import type { Node } from '@xyflow/react'
import { logger } from '~/shared/utils/logger'

type PersistedCanvasNode = Omit<Node, 'selected' | 'draggable' | 'dragging' | 'resizing'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isCanvasPosition(value: unknown): value is { x: number; y: number } {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function isPersistedCanvasNode(node: unknown): node is PersistedCanvasNode {
  return (
    isRecord(node) &&
    typeof node.id === 'string' &&
    (node.type === undefined || typeof node.type === 'string') &&
    isCanvasPosition(node.position) &&
    isRecord(node.data) &&
    (node.width === undefined || isFiniteNumber(node.width)) &&
    (node.height === undefined || isFiniteNumber(node.height))
  )
}

function buildSafePersistedCanvasNode(node: Node): PersistedCanvasNode {
  const safeNode: PersistedCanvasNode = {
    id: node.id,
    position: isCanvasPosition(node.position) ? node.position : { x: 0, y: 0 },
    data: isRecord(node.data) ? node.data : {},
  }

  if (typeof node.type === 'string') {
    safeNode.type = node.type
  }
  if (isFiniteNumber(node.width)) {
    safeNode.width = node.width
  }
  if (isFiniteNumber(node.height)) {
    safeNode.height = node.height
  }

  return safeNode
}

export function sanitizeNodeForPersistence(
  node: Node,
  operation: string,
  fallbackNode: Node = node,
): PersistedCanvasNode {
  try {
    const persistedNode = stripEphemeralCanvasNodeState(node)
    if (!isPersistedCanvasNode(persistedNode)) {
      throw new TypeError('stripEphemeralCanvasNodeState returned an invalid canvas node shape')
    }
    return persistedNode
  } catch (error) {
    logger.error('Canvas node persistence sanitization failed', {
      operation,
      nodeId: node.id,
      nodeType: node.type,
      error,
    })
    return buildSafePersistedCanvasNode(fallbackNode)
  }
}
