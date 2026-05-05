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
  resizeCanvasNodesCommand,
  setCanvasNodePositionsCommand,
} from './canvas-document-commands'
import { sanitizeNodeForPersistence } from './canvas-node-persistence-sanitizer'
import { measureCanvasPerformance } from '../performance/canvas-performance-metrics'
import { transactCanvasMap, transactCanvasMaps } from './canvas-yjs-transactions'
import { clearStrokePathCache } from '../../nodes/stroke/stroke-path-cache'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'
import type * as Y from 'yjs'

interface CreateCanvasDocumentWriterOptions {
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
}

export function createCanvasDocumentWriter({
  nodesMap,
  edgesMap,
}: CreateCanvasDocumentWriterOptions): CanvasDocumentWriter {
  return {
    createNode: (node) => {
      transactCanvasMap(nodesMap, () => {
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
      transactCanvasMap(nodesMap, () => {
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
      transactCanvasMap(edgesMap, () => {
        measureCanvasPerformance('canvas.document.edges.patch', { edgeCount: updates.size }, () => {
          patchCanvasEdgesCommand({
            edgesMap,
            updates,
          })
        })
      })
    },
    resizeNode: (nodeId, width, height, position) => {
      transactCanvasMap(nodesMap, () => {
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
    resizeNodes: (updates) => {
      if (updates.size === 0) return
      transactCanvasMap(nodesMap, () => {
        measureCanvasPerformance(
          'canvas.document.nodes.resize',
          { nodeCount: updates.size },
          () => {
            resizeCanvasNodesCommand({
              nodesMap,
              updates,
              sanitizeNode: sanitizeNodeForPersistence,
            })
          },
        )
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
      for (const nodeId of nodeIds) {
        clearStrokePathCache(nodeId)
      }
    },
    createEdge: (connection, defaults) => {
      transactCanvasMap(edgesMap, () => {
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
      transactCanvasMap(edgesMap, () => {
        deleteCanvasEdgesCommand({ edgesMap, edgeIds })
      })
    },
    setNodePositions: (positions) => {
      if (positions.size === 0) return
      transactCanvasMap(nodesMap, () => {
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
