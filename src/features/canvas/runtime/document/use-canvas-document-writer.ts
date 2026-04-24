import type { CanvasDocumentWriter } from '../../tools/canvas-tool-types'
import { getNextCanvasElementZIndex } from './canvas-z-index'
import {
  createCanvasEdgeCommand,
  createCanvasNodeCommand,
  deleteCanvasEdgesCommand,
  deleteCanvasSelectionCommand,
  patchCanvasEdgesCommand,
  patchCanvasNodeDataCommand,
  resizeCanvasNodeCommand,
  setCanvasNodePositionsCommand,
} from './canvas-document-commands'
import { sanitizeNodeForPersistence } from './canvas-node-persistence-sanitizer'
import { measureCanvasPerformance } from '../performance/canvas-performance-metrics'
import { transactCanvasMap, transactCanvasMaps } from './canvas-yjs-transactions'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface CreateCanvasDocumentWriterOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
}

export function createCanvasDocumentWriter({
  nodesMap,
  edgesMap,
}: CreateCanvasDocumentWriterOptions): CanvasDocumentWriter {
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
    patchNodeData: (updates) => {
      if (updates.size === 0) return
      withNodeTransaction(() => {
        measureCanvasPerformance(
          'canvas.document.nodes.patch-data',
          { nodeCount: updates.size },
          () => {
            patchCanvasNodeDataCommand({
              nodesMap,
              updates,
              sanitizeNode: sanitizeNodeForPersistence,
            })
          },
        )
      })
    },
    patchEdges: (updates) => {
      if (updates.size === 0) return
      withEdgeTransaction(() => {
        measureCanvasPerformance('canvas.document.edges.patch', { edgeCount: updates.size }, () => {
          patchCanvasEdgesCommand({
            edgesMap,
            updates,
          })
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
      if (nodeIds.size === 0) return
      transactCanvasMaps(nodesMap, edgesMap, () => {
        deleteCanvasSelectionCommand({
          nodesMap,
          edgesMap,
          selection: { nodeIds, edgeIds: new Set() },
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
      if (edgeIds.size === 0) return
      withEdgeTransaction(() => {
        deleteCanvasEdgesCommand({ edgesMap, edgeIds })
      })
    },
    setNodePositions: (positions) => {
      if (positions.size === 0) return
      withNodeTransaction(() => {
        measureCanvasPerformance(
          'canvas.document.nodes.set-position',
          { nodeCount: positions.size },
          () => {
            setCanvasNodePositionsCommand({
              nodesMap,
              positions,
              sanitizeNode: sanitizeNodeForPersistence,
            })
          },
        )
      })
    },
  }
}
