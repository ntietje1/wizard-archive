import { useMemo } from 'react'
import type { CanvasDocumentWriter } from '../../tools/canvas-tool-types'
import { getNextCanvasElementZIndex } from './canvas-z-index'
import {
  createCanvasEdgeCommand,
  createCanvasNodeCommand,
  deleteCanvasEdgesCommand,
  deleteCanvasSelectionCommand,
  resizeCanvasNodeCommand,
  setCanvasNodePositionCommand,
  updateCanvasEdgeCommand,
  updateCanvasNodeCommand,
  updateCanvasNodeDataCommand,
} from './canvas-document-commands'
import { sanitizeNodeForPersistence } from './canvas-node-persistence-sanitizer'
import { transactCanvasMap, transactCanvasMaps } from './canvas-yjs-transactions'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasDocumentWriterOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
}

export function useCanvasDocumentWriter({
  nodesMap,
  edgesMap,
}: UseCanvasDocumentWriterOptions): CanvasDocumentWriter {
  return useMemo(() => {
    const withNodeTransaction = (fn: () => void) => transactCanvasMap(nodesMap, fn)
    const withEdgeTransaction = (fn: () => void) => transactCanvasMap(edgesMap, fn)

    return {
      createNode: (node) => {
        withNodeTransaction(() => {
          createCanvasNodeCommand({
            nodesMap,
            node,
            sanitizeNode: sanitizeNodeForPersistence,
            nextZIndex: getNextCanvasElementZIndex(Array.from(nodesMap.values())),
          })
        })
      },
      updateNode: (nodeId, updater) => {
        withNodeTransaction(() => {
          updateCanvasNodeCommand({
            nodesMap,
            nodeId,
            updater,
            sanitizeNode: sanitizeNodeForPersistence,
          })
        })
      },
      updateNodeData: (nodeId, data) => {
        withNodeTransaction(() => {
          updateCanvasNodeDataCommand({
            nodesMap,
            nodeId,
            data,
            sanitizeNode: sanitizeNodeForPersistence,
          })
        })
      },
      updateEdge: (edgeId, updater) => {
        withEdgeTransaction(() => {
          updateCanvasEdgeCommand({
            edgesMap,
            edgeId,
            updater,
          })
        })
      },
      resizeNode: (nodeId, width, height, position) => {
        withNodeTransaction(() => {
          resizeCanvasNodeCommand({
            nodesMap,
            nodeId,
            width,
            height,
            position,
            sanitizeNode: sanitizeNodeForPersistence,
          })
        })
      },
      deleteNodes: (nodeIds) => {
        if (nodeIds.length === 0) return
        transactCanvasMaps(nodesMap, edgesMap, () => {
          deleteCanvasSelectionCommand({
            nodesMap,
            edgesMap,
            selection: { nodeIds, edgeIds: [] },
          })
        })
      },
      createEdge: (connection, defaults) => {
        withEdgeTransaction(() => {
          createCanvasEdgeCommand({
            edgesMap,
            connection,
            defaults,
            nextZIndex: getNextCanvasElementZIndex(Array.from(edgesMap.values())),
          })
        })
      },
      deleteEdges: (edgeIds) => {
        if (edgeIds.length === 0) return
        withEdgeTransaction(() => {
          deleteCanvasEdgesCommand({ edgesMap, edgeIds })
        })
      },
      setNodePosition: (nodeId, position) => {
        withNodeTransaction(() => {
          setCanvasNodePositionCommand({
            nodesMap,
            nodeId,
            position,
            sanitizeNode: sanitizeNodeForPersistence,
          })
        })
      },
    }
  }, [edgesMap, nodesMap])
}
