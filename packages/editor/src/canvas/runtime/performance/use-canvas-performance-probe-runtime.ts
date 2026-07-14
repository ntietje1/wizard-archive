import { useEffect } from 'react'
import { createCanvasNodePlacement } from '../../nodes/canvas-node-modules'
import {
  createEmbedCanvasNode,
  createResourceEmbedCanvasNode,
} from '../../nodes/embed/embed-node-creation'
import { getStrokeBounds } from '../../nodes/stroke/stroke-node-model'
import { clearAllStrokePathCache } from '../../nodes/stroke/stroke-path-cache'
import { exposeCanvasPerformanceRuntime } from './canvas-performance-metrics'
import type { CanvasDragController } from '../../system/canvas-drag-controller'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type { CanvasViewportController } from '../../system/canvas-viewport-controller'
import type { CanvasDocumentWriter, CanvasSelectionController } from '../../tools/canvas-tool-types'
import type * as Y from 'yjs'
import type { CanvasCollaborationProvider } from '../../session-contract'
import { DOMAIN_ID_KIND, generateDomainId, parseDomainId } from '../../../resources/domain-id'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../../document-contract'
import type { SidebarItemId } from '../../../../../../shared/common/ids'

const PERFORMANCE_STROKE_WIDTH = 160
const PERFORMANCE_STROKE_AMPLITUDE = 28
const COORDINATE_PROBE_Z_INDEX = 10_000
type CanvasPerformanceRuntime = Parameters<typeof exposeCanvasPerformanceRuntime>[0]
type SeedTextNodesOptions = Parameters<CanvasPerformanceRuntime['seedTextNodes']>[0]
type SeedStrokeNodesOptions = Parameters<CanvasPerformanceRuntime['seedStrokeNodes']>[0]
type SeedCoordinateProbeNodeOptions = Parameters<
  CanvasPerformanceRuntime['seedCoordinateProbeNode']
>[0]
type SeedEdgeOptions = Parameters<CanvasPerformanceRuntime['seedEdge']>[0]
type SeedEmbedNodeOptions = Parameters<CanvasPerformanceRuntime['seedEmbedNode']>[0]
type CanvasPerformanceRuntimeDependencies = {
  canvasId: SidebarItemId
  canvasEngine: CanvasEngine
  canEdit: boolean
  documentWriter: CanvasDocumentWriter
  doc: Y.Doc
  dragController: CanvasDragController
  edgesMap: Y.Map<CanvasDocumentEdge>
  nodesMap: Y.Map<CanvasDocumentNode>
  provider: CanvasCollaborationProvider | null
  selection: CanvasSelectionController
  viewportController: CanvasViewportController
}

export function useCanvasPerformanceProbeRuntime({
  canvasId,
  canvasEngine,
  canEdit,
  documentWriter,
  doc,
  dragController,
  edgesMap,
  nodesMap,
  provider,
  selection,
  viewportController,
}: CanvasPerformanceRuntimeDependencies) {
  useEffect(() => {
    const runtime = createCanvasPerformanceRuntime({
      canvasId,
      canvasEngine,
      canEdit,
      documentWriter,
      doc,
      dragController,
      edgesMap,
      nodesMap,
      provider,
      selection,
      viewportController,
    })
    return exposeCanvasPerformanceRuntime(runtime)
  }, [
    canvasEngine,
    canvasId,
    canEdit,
    doc,
    documentWriter,
    dragController,
    edgesMap,
    nodesMap,
    provider,
    selection,
    viewportController,
  ])
}

function createCanvasPerformanceRuntime(
  dependencies: CanvasPerformanceRuntimeDependencies,
): CanvasPerformanceRuntime {
  const requireCanEdit = () => {
    if (!dependencies.canEdit) {
      throw new Error('Canvas performance runtime mutation requires edit access')
    }
  }

  return {
    clearCanvas: () => clearPerformanceCanvas(dependencies, requireCanEdit),
    getCanvasId: () => dependencies.canvasId,
    getCounts: () => ({
      nodes: dependencies.nodesMap.size,
      edges: dependencies.edgesMap.size,
    }),
    getSnapshot: () => getPerformanceSnapshot(dependencies),
    getMetrics: () => window.__WA_CANVAS_PERF__?.entries ?? [],
    clearMetrics: clearPerformanceMetrics,
    setSelection: (selection) => setPerformanceSelection(dependencies.selection, selection),
    seedTextNodes: (options) => seedPerformanceTextNodes(dependencies, requireCanEdit, options),
    seedCoordinateProbeNode: (options) =>
      seedPerformanceCoordinateProbeNode(dependencies, requireCanEdit, options),
    seedStrokeNodes: (options) => seedPerformanceStrokeNodes(dependencies, requireCanEdit, options),
    seedEdge: (options) => seedPerformanceEdge(dependencies, requireCanEdit, options),
    seedEmbedNode: (options) => seedPerformanceEmbedNode(dependencies, requireCanEdit, options),
    updateSelectedNodeSurface: () => updateSelectedNodeSurface(dependencies, requireCanEdit),
    selectFirstNodes: (count) =>
      selectFirstPerformanceNodes(dependencies.nodesMap, dependencies.selection, count),
    getSelectedCount: () => {
      const snapshot = dependencies.selection.getSnapshot()
      return snapshot.nodeIds.size + snapshot.edgeIds.size
    },
    profileSelectedNodeDrag: ({ delta, steps }) => {
      requireCanEdit()
      requirePositiveFiniteInteger('steps', steps)
      requireFinitePosition('delta', delta)
      dependencies.dragController.profileDrag({
        nodeIds: dependencies.selection.getSnapshot().nodeIds,
        delta,
        steps,
      })
    },
    getNodePosition: (nodeId) =>
      dependencies.canvasEngine.getSnapshot().nodeLookup.get(nodeId)?.node.position ?? null,
    setViewport: (viewport) => {
      requireCanEdit()
      requireFiniteNumber('viewport.x', viewport.x)
      requireFiniteNumber('viewport.y', viewport.y)
      requirePositiveFiniteNumber('viewport.zoom', viewport.zoom)
      dependencies.viewportController.syncFromDocumentOrAdapter(viewport)
    },
    getViewport: () => dependencies.viewportController.getViewport(),
    flushUpdates: async () => {
      await dependencies.provider?.flushUpdates()
    },
  }
}

function clearPerformanceCanvas(
  { doc, edgesMap, nodesMap, selection }: CanvasPerformanceRuntimeDependencies,
  requireCanEdit: () => void,
) {
  requireCanEdit()
  doc.transact(() => {
    nodesMap.clear()
    edgesMap.clear()
  })
  clearAllStrokePathCache()
  selection.clearSelection()
}

function getPerformanceSnapshot({
  edgesMap,
  nodesMap,
  selection,
  viewportController,
}: CanvasPerformanceRuntimeDependencies) {
  const selectionSnapshot = selection.getSnapshot()
  return {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
    selection: {
      nodeIds: Array.from(selectionSnapshot.nodeIds, (nodeId) => {
        const parsedNodeId = parseDomainId(DOMAIN_ID_KIND.canvasNode, nodeId)
        if (!parsedNodeId) {
          throw new Error(`Canvas selection contains invalid node id: ${nodeId}`)
        }
        return parsedNodeId
      }),
      edgeIds: Array.from(selectionSnapshot.edgeIds),
    },
    viewport: viewportController.getViewport(),
  }
}

function clearPerformanceMetrics() {
  if (window.__WA_CANVAS_PERF__) {
    window.__WA_CANVAS_PERF__.entries.length = 0
  }
}

function setPerformanceSelection(
  selection: CanvasSelectionController,
  { nodeIds, edgeIds }: Parameters<CanvasPerformanceRuntime['setSelection']>[0],
) {
  if (nodeIds === undefined && edgeIds === undefined) {
    throw new Error('setSelection requires nodeIds or edgeIds')
  }
  selection.setSelection({ nodeIds: new Set(nodeIds), edgeIds: new Set(edgeIds) })
}

function seedPerformanceTextNodes(
  { doc, nodesMap }: CanvasPerformanceRuntimeDependencies,
  requireCanEdit: () => void,
  {
    count,
    columns = 25,
    nodeIds,
    labelPrefix = 'Perf node',
    size,
    spacingX = 180,
    spacingY = 120,
    start = { x: 0, y: 0 },
    style,
    zIndex,
  }: SeedTextNodesOptions,
) {
  requireCanEdit()
  validatePerformanceGrid({ columns, count, spacingX, spacingY, start, zIndex })
  validateNodeIds(count, nodeIds)
  if (size) {
    requirePositiveFiniteNumber('size.width', size.width)
    requirePositiveFiniteNumber('size.height', size.height)
  }
  doc.transact(() => {
    for (let index = 0; index < count; index += 1) {
      const placement = createCanvasNodePlacement('text', {
        position: getPerformanceGridPosition({ columns, index, spacingX, spacingY, start }),
        size,
        data: {
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: `${labelPrefix} ${index}`, styles: {} }],
            },
          ],
          ...style,
        },
      })
      const node = {
        ...placement.node,
        id: nodeIds?.[index] ?? placement.node.id,
        zIndex: getPerformanceZIndex(index, zIndex),
      }
      nodesMap.set(node.id, node)
    }
  })
}

function seedPerformanceCoordinateProbeNode(
  { doc, nodesMap, selection }: CanvasPerformanceRuntimeDependencies,
  requireCanEdit: () => void,
  { id, start = { x: 0, y: 0 } }: SeedCoordinateProbeNodeOptions,
) {
  requireCanEdit()
  requireFinitePosition('start', start)
  doc.transact(() => {
    const embedNode = createEmbedCanvasNode({ kind: 'empty' }, start)
    const node = {
      ...embedNode,
      id,
      zIndex: COORDINATE_PROBE_Z_INDEX,
    }
    nodesMap.set(node.id, node)
  })
  selection.setSelection({ nodeIds: new Set([id]), edgeIds: new Set() })
}

function seedPerformanceStrokeNodes(
  { doc, nodesMap }: CanvasPerformanceRuntimeDependencies,
  requireCanEdit: () => void,
  {
    count,
    columns = 10,
    nodeIds,
    spacingX = 240,
    spacingY = 160,
    start = { x: 0, y: 0 },
    pointsPerStroke = 80,
    style,
    zIndex,
  }: SeedStrokeNodesOptions,
) {
  requireCanEdit()
  validatePerformanceGrid({ columns, count, spacingX, spacingY, start, zIndex })
  validateNodeIds(count, nodeIds)
  requirePositiveFiniteInteger('pointsPerStroke', pointsPerStroke)
  if (style?.opacity !== undefined) {
    requireFiniteNumber('style.opacity', style.opacity)
  }
  if (style?.size !== undefined) {
    requirePositiveFiniteNumber('style.size', style.size)
  }
  doc.transact(() => {
    for (let index = 0; index < count; index += 1) {
      const origin = getPerformanceGridPosition({ columns, index, spacingX, spacingY, start })
      const points = createPerformanceStrokePoints(origin, pointsPerStroke)
      const size = style?.size ?? 8
      const bounds = getStrokeBounds(points, size)
      const id = nodeIds?.[index] ?? generateDomainId(DOMAIN_ID_KIND.canvasNode)
      nodesMap.set(id, {
        id,
        type: 'stroke',
        position: { x: bounds.x, y: bounds.y },
        width: bounds.width,
        height: bounds.height,
        data: {
          points,
          color: style?.color ?? '#2563eb',
          size,
          opacity: style?.opacity ?? 100,
          bounds,
        },
        zIndex: getPerformanceZIndex(index, zIndex),
      })
    }
  })
}

function seedPerformanceEdge(
  { doc, edgesMap }: CanvasPerformanceRuntimeDependencies,
  requireCanEdit: () => void,
  {
    id,
    source,
    target,
    sourceHandle = 'right',
    targetHandle = 'left',
    type = 'bezier',
    style,
    zIndex,
  }: SeedEdgeOptions,
) {
  requireCanEdit()
  const edgeId = id ?? `perf-edge-${source}-${target}`
  validateOptionalZIndex(zIndex)
  doc.transact(() => {
    edgesMap.set(edgeId, {
      id: edgeId,
      source,
      target,
      sourceHandle,
      targetHandle,
      type,
      style,
      zIndex: zIndex ?? edgesMap.size,
    })
  })
}

function seedPerformanceEmbedNode(
  { doc, nodesMap }: CanvasPerformanceRuntimeDependencies,
  requireCanEdit: () => void,
  { id, resourceId, position, width, height, zIndex }: SeedEmbedNodeOptions,
) {
  requireCanEdit()
  requireFinitePosition('position', position)
  if (width !== undefined) {
    requirePositiveFiniteNumber('width', width)
  }
  if (height !== undefined) {
    requirePositiveFiniteNumber('height', height)
  }
  validateOptionalZIndex(zIndex)
  doc.transact(() => {
    const node = createResourceEmbedCanvasNode(resourceId, position)
    nodesMap.set(id, {
      ...node,
      id,
      width: width ?? node.width,
      height: height ?? node.height,
      zIndex: zIndex ?? nodesMap.size,
    })
  })
}

function updateSelectedNodeSurface(
  { documentWriter, selection }: CanvasPerformanceRuntimeDependencies,
  requireCanEdit: () => void,
) {
  requireCanEdit()
  const updates = new Map<string, Record<string, unknown>>()
  for (const nodeId of selection.getSnapshot().nodeIds) {
    updates.set(nodeId, {
      backgroundColor: '#e8f2ff',
      borderStroke: '#2563eb',
    })
  }
  documentWriter.patchNodeData(updates)
}

function selectFirstPerformanceNodes(
  nodesMap: Y.Map<CanvasDocumentNode>,
  selection: CanvasSelectionController,
  count: number,
) {
  requirePositiveFiniteInteger('count', count)
  const nodeIds = new Set(Array.from(nodesMap.keys()).slice(0, count))
  selection.setSelection({ nodeIds, edgeIds: new Set() })
}

function validateNodeIds(count: number, nodeIds: ReadonlyArray<string> | undefined) {
  if (nodeIds !== undefined && nodeIds.length !== count) {
    throw new Error('nodeIds must contain exactly one id per node')
  }
}

function requirePositiveFiniteInteger(name: string, value: number) {
  if (!Number.isFinite(value) || value < 1 || Math.floor(value) !== value) {
    throw new Error(`${name} must be a positive integer`)
  }
}

function requireFiniteNumber(name: string, value: number) {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite`)
  }
}

function requirePositiveFiniteNumber(name: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`)
  }
}

function requireFinitePosition(name: string, position: { x: number; y: number }) {
  requireFiniteNumber(`${name}.x`, position.x)
  requireFiniteNumber(`${name}.y`, position.y)
}

function validatePerformanceGrid({
  columns,
  count,
  spacingX,
  spacingY,
  start,
  zIndex,
}: {
  columns: number
  count: number
  spacingX: number
  spacingY: number
  start: { x: number; y: number }
  zIndex?: number
}) {
  requirePositiveFiniteInteger('count', count)
  requirePositiveFiniteInteger('columns', columns)
  requireFiniteNumber('spacingX', spacingX)
  requireFiniteNumber('spacingY', spacingY)
  requireFinitePosition('start', start)
  validateOptionalZIndex(zIndex)
}

function validateOptionalZIndex(zIndex: number | undefined) {
  if (zIndex !== undefined) {
    requireFiniteNumber('zIndex', zIndex)
  }
}

function getPerformanceGridPosition({
  columns,
  index,
  spacingX,
  spacingY,
  start,
}: {
  columns: number
  index: number
  spacingX: number
  spacingY: number
  start: { x: number; y: number }
}) {
  const column = index % columns
  const row = Math.floor(index / columns)
  return {
    x: start.x + column * spacingX,
    y: start.y + row * spacingY,
  }
}

function getPerformanceZIndex(index: number, zIndex: number | undefined) {
  return zIndex === undefined ? index : zIndex + index
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
