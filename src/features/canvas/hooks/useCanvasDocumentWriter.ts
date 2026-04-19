import { useMemo } from 'react'
import { getCanvasNodeModuleByType } from '../nodes/canvas-node-registry'
import type { CanvasNodeData, CanvasNodeType } from '../nodes/canvas-node-module-types'
import type { CanvasDocumentWriter } from '../tools/canvas-tool-types'
import { stripEphemeralCanvasNodeState } from '../utils/canvas-node-persistence'
import type { Connection, Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'
import { logger } from '~/shared/utils/logger'

interface UseCanvasDocumentWriterOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
}

type ResizableCanvasNode = Node<CanvasNodeData, CanvasNodeType>
type PersistedCanvasNode = Omit<Node, 'selected' | 'draggable' | 'dragging' | 'resizing'>

function isResizableCanvasNode(node: Node | undefined): node is ResizableCanvasNode {
  if (!node || !node.type || typeof node.data !== 'object' || node.data === null) {
    return false
  }

  return getCanvasNodeModuleByType(node.type) !== null
}

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

function sanitizeNodeForPersistence(
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
    logger.error('useCanvasDocumentWriter: failed to sanitize canvas node', {
      operation,
      nodeId: node.id,
      nodeType: node.type,
      error,
    })
    return buildSafePersistedCanvasNode(fallbackNode)
  }
}

export function useCanvasDocumentWriter({
  nodesMap,
  edgesMap,
}: UseCanvasDocumentWriterOptions): CanvasDocumentWriter {
  return useMemo(() => {
    const withTransaction = <TValue,>(map: Y.Map<TValue>, fn: () => void) => {
      if (map.doc) {
        map.doc.transact(fn)
        return
      }

      fn()
    }

    const withNodeTransaction = (fn: () => void) => withTransaction(nodesMap, fn)
    const withEdgeTransaction = (fn: () => void) => withTransaction(edgesMap, fn)

    return {
      createNode: (node) => {
        withNodeTransaction(() => {
          if (nodesMap.has(node.id)) {
            throw new Error(`Canvas node "${node.id}" already exists`)
          }
          nodesMap.set(node.id, sanitizeNodeForPersistence(node, 'createNode'))
        })
      },
      updateNode: (nodeId, updater) => {
        withNodeTransaction(() => {
          const existing = nodesMap.get(nodeId)
          if (!existing) return
          nodesMap.set(
            nodeId,
            sanitizeNodeForPersistence(updater(existing), 'updateNode', existing),
          )
        })
      },
      updateNodeData: (nodeId, data) => {
        withNodeTransaction(() => {
          const existing = nodesMap.get(nodeId)
          if (!existing) return
          nodesMap.set(
            nodeId,
            sanitizeNodeForPersistence(
              {
                ...existing,
                data: { ...existing.data, ...data },
              },
              'updateNodeData',
              existing,
            ),
          )
        })
      },
      resizeNode: (nodeId, width, height, position) => {
        withNodeTransaction(() => {
          const existing = nodesMap.get(nodeId)
          if (!existing) return
          const nodeModule = getCanvasNodeModuleByType(existing.type)
          nodesMap.set(
            nodeId,
            sanitizeNodeForPersistence(
              nodeModule?.resize && isResizableCanvasNode(existing)
                ? nodeModule.resize(existing, { width, height, position })
                : { ...existing, width, height, position },
              'resizeNode',
              existing,
            ),
          )
        })
      },
      deleteNodes: (nodeIds) => {
        if (nodeIds.length === 0) return
        withNodeTransaction(() => {
          for (const nodeId of nodeIds) {
            nodesMap.delete(nodeId)
          }
        })
      },
      createEdge: (connection) => {
        const id = createCanvasEdgeId(connection)
        const edge: Edge = { id, ...connection }
        withEdgeTransaction(() => {
          edgesMap.set(id, edge)
        })
      },
      deleteEdges: (edgeIds) => {
        if (edgeIds.length === 0) return
        withEdgeTransaction(() => {
          for (const edgeId of edgeIds) {
            edgesMap.delete(edgeId)
          }
        })
      },
      setNodePosition: (nodeId, position) => {
        withNodeTransaction(() => {
          const existing = nodesMap.get(nodeId)
          if (!existing) return
          nodesMap.set(
            nodeId,
            sanitizeNodeForPersistence({ ...existing, position }, 'setNodePosition', existing),
          )
        })
      },
    }
  }, [edgesMap, nodesMap])
}

function createCanvasEdgeId(connection: Connection): string {
  return `e-${connection.source}-${connection.target}-${crypto.randomUUID()}`
}
