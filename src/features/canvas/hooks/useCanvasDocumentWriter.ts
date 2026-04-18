import { useCallback, useMemo } from 'react'
import { isStrokeNode, resizeStrokeNode } from '../utils/canvas-stroke-utils'
import type { CanvasDocumentWriter } from '../tools/canvas-tool-types'
import type { Connection, Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasDocumentWriterOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
}

export function useCanvasDocumentWriter({
  nodesMap,
  edgesMap,
}: UseCanvasDocumentWriterOptions): CanvasDocumentWriter {
  const withTransaction = useCallback(<TValue,>(map: Y.Map<TValue>, fn: () => void) => {
    if (map.doc) {
      map.doc.transact(fn)
      return
    }

    fn()
  }, [])

  const withNodeTransaction = useCallback((fn: () => void) => withTransaction(nodesMap, fn), [
    nodesMap,
    withTransaction,
  ])

  const withEdgeTransaction = useCallback((fn: () => void) => withTransaction(edgesMap, fn), [
    edgesMap,
    withTransaction,
  ])

  return useMemo(
    () => ({
      createNode: (node) => {
        withNodeTransaction(() => {
          if (nodesMap.has(node.id)) {
            throw new Error(`Canvas node "${node.id}" already exists`)
          }
          nodesMap.set(node.id, node)
        })
      },
      updateNode: (nodeId, updater) => {
        withNodeTransaction(() => {
          const existing = nodesMap.get(nodeId)
          if (!existing) return
          nodesMap.set(nodeId, updater(existing))
        })
      },
      updateNodeData: (nodeId, data) => {
        withNodeTransaction(() => {
          const existing = nodesMap.get(nodeId)
          if (!existing) return
          nodesMap.set(nodeId, {
            ...existing,
            data: { ...existing.data, ...data },
          })
        })
      },
      resizeNode: (nodeId, width, height, position) => {
        withNodeTransaction(() => {
          const existing = nodesMap.get(nodeId)
          if (!existing) return
          nodesMap.set(
            nodeId,
            isStrokeNode(existing)
              ? resizeStrokeNode(existing, { width, height, position })
              : { ...existing, width, height, position },
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
          nodesMap.set(nodeId, { ...existing, position })
        })
      },
    }),
    [edgesMap, nodesMap, withEdgeTransaction, withNodeTransaction],
  )
}

function createCanvasEdgeId(connection: Connection): string {
  return `e-${connection.source}-${connection.target}-${crypto.randomUUID()}`
}
