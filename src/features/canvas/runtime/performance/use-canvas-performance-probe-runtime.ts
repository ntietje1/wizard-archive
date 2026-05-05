import { useEffect } from 'react'
import { createCanvasNodePlacement } from '../../nodes/canvas-node-modules'
import { getStrokeBounds } from '../../nodes/stroke/stroke-node-model'
import { clearAllStrokePathCache } from '../../nodes/stroke/stroke-path-cache'
import { exposeCanvasPerformanceRuntime } from './canvas-performance-metrics'
import type { CanvasDragController } from '../../system/canvas-drag-controller'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type { CanvasViewportController } from '../../system/canvas-viewport-controller'
import type { CanvasDocumentWriter, CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'
import type * as Y from 'yjs'

const PERFORMANCE_STROKE_WIDTH = 160
const PERFORMANCE_STROKE_AMPLITUDE = 28
const COORDINATE_PROBE_Z_INDEX = 10_000

export function useCanvasPerformanceProbeRuntime({
  canvasEngine,
  documentWriter,
  doc,
  dragController,
  edgesMap,
  nodesMap,
  selection,
  viewportController,
}: {
  canvasEngine: CanvasEngine
  documentWriter: CanvasDocumentWriter
  doc: Y.Doc
  dragController: CanvasDragController
  edgesMap: Y.Map<CanvasDocumentEdge>
  nodesMap: Y.Map<CanvasDocumentNode>
  selection: CanvasSelectionController
  viewportController: CanvasViewportController
}) {
  useEffect(
    () =>
      exposeCanvasPerformanceRuntime({
        clearCanvas: () => {
          doc.transact(() => {
            nodesMap.clear()
            edgesMap.clear()
          })
          clearAllStrokePathCache()
          selection.clearSelection()
        },
        getCounts: () => ({
          nodes: nodesMap.size,
          edges: edgesMap.size,
        }),
        seedTextNodes: ({
          count,
          columns = 25,
          spacingX = 180,
          spacingY = 120,
          start = { x: 0, y: 0 },
        }) => {
          doc.transact(() => {
            for (let index = 0; index < count; index += 1) {
              const column = index % columns
              const row = Math.floor(index / columns)
              const placement = createCanvasNodePlacement('text', {
                position: {
                  x: start.x + column * spacingX,
                  y: start.y + row * spacingY,
                },
                data: {
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: `Perf node ${index}`, styles: {} }],
                    },
                  ],
                },
              })
              const node = {
                ...placement.node,
                id: `perf-node-${index}`,
                zIndex: index,
              }
              nodesMap.set(node.id, node)
            }
          })
        },
        seedCoordinateProbeNode: ({ id, start = { x: 0, y: 0 } }) => {
          doc.transact(() => {
            const placement = createCanvasNodePlacement('embed', {
              position: start,
            })
            const node = {
              ...placement.node,
              id,
              zIndex: COORDINATE_PROBE_Z_INDEX,
            }
            nodesMap.set(node.id, node)
          })
          selection.setSelection({ nodeIds: new Set([id]), edgeIds: new Set() })
        },
        seedStrokeNodes: ({
          count,
          columns = 10,
          spacingX = 240,
          spacingY = 160,
          start = { x: 0, y: 0 },
          pointsPerStroke = 80,
        }) => {
          doc.transact(() => {
            for (let index = 0; index < count; index += 1) {
              const column = index % columns
              const row = Math.floor(index / columns)
              const origin = {
                x: start.x + column * spacingX,
                y: start.y + row * spacingY,
              }
              const points = createPerformanceStrokePoints(origin, pointsPerStroke)
              const size = 8
              const bounds = getStrokeBounds(points, size)
              nodesMap.set(`perf-stroke-${index}`, {
                id: `perf-stroke-${index}`,
                type: 'stroke',
                position: { x: bounds.x, y: bounds.y },
                width: bounds.width,
                height: bounds.height,
                data: {
                  points,
                  color: '#2563eb',
                  size,
                  opacity: 100,
                  bounds,
                },
                zIndex: index,
              })
            }
          })
        },
        updateSelectedNodeSurface: () => {
          const updates = new Map<string, Record<string, unknown>>()
          for (const nodeId of selection.getSnapshot().nodeIds) {
            updates.set(nodeId, {
              backgroundColor: '#e8f2ff',
              borderStroke: '#2563eb',
            })
          }
          documentWriter.patchNodeData(updates)
        },
        selectFirstNodes: (count) => {
          const nodeIds = new Set<string>()
          for (let index = 0; index < count; index += 1) {
            nodeIds.add(`perf-node-${index}`)
          }
          selection.setSelection({ nodeIds, edgeIds: new Set() })
        },
        getSelectedCount: () => {
          const snapshot = selection.getSnapshot()
          return snapshot.nodeIds.size + snapshot.edgeIds.size
        },
        profileSelectedNodeDrag: ({ delta, steps }) => {
          dragController.profileDrag({
            nodeIds: selection.getSnapshot().nodeIds,
            delta,
            steps,
          })
        },
        getNodePosition: (nodeId) =>
          canvasEngine.getSnapshot().nodeLookup.get(nodeId)?.node.position ?? null,
        setViewport: (viewport) => {
          viewportController.syncFromDocumentOrAdapter(viewport)
        },
        getViewport: () => viewportController.getViewport(),
      }),
    [
      canvasEngine,
      doc,
      documentWriter,
      dragController,
      edgesMap,
      nodesMap,
      selection,
      viewportController,
    ],
  )
}

function createPerformanceStrokePoints(
  origin: { x: number; y: number },
  pointsPerStroke: number,
): Array<[number, number, number]> {
  const safePointCount = Math.max(2, Math.floor(pointsPerStroke))
  const points: Array<[number, number, number]> = []

  for (let index = 0; index < safePointCount; index += 1) {
    const progress = index / (safePointCount - 1)
    points.push([
      origin.x + progress * PERFORMANCE_STROKE_WIDTH,
      origin.y + Math.sin(progress * Math.PI * 4) * PERFORMANCE_STROKE_AMPLITUDE,
      0.5,
    ])
  }

  return points
}
