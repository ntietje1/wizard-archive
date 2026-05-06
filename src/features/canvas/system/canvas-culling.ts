import { normalizeCanvasEdgeStyle } from '../edges/shared/canvas-edge-style'
import { parseCanvasStrokeNodeData } from 'convex/canvases/validation'
import { getCanvasEdgeInteractionWidth } from '../edges/shared/canvas-edge-geometry'
import { getCanvasNodeBounds } from '../nodes/shared/canvas-node-bounds'
import type { CanvasSelectionState } from './canvas-selection'
import type { Bounds } from '../utils/canvas-geometry-utils'
import { rectIntersectsBounds } from '../utils/canvas-geometry-utils'
import type { CanvasViewport } from '../types/canvas-domain-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'

const CULLING_OVERSCAN_PX = 512
const MIN_ZOOM = 1e-6

export type CanvasCullingDiff = {
  nodeIds: ReadonlyMap<string, boolean>
  edgeIds: ReadonlyMap<string, boolean>
}

export type CanvasCullingSnapshot = {
  culledNodeIds: ReadonlySet<string>
  culledEdgeIds: ReadonlySet<string>
}

type CanvasCullingState = {
  viewport: CanvasViewport
  surfaceBounds: Pick<DOMRect, 'width' | 'height'> | null
  nodeLookup: ReadonlyMap<string, CanvasCullingNode>
  edges: ReadonlyArray<CanvasDocumentEdge>
  selection: CanvasSelectionState
  draggingNodeIds: ReadonlySet<string>
}

type CanvasCullingNode = {
  node: CanvasDocumentNode
  measured: {
    width?: number
    height?: number
  }
}

export function createEmptyCanvasCullingSnapshot(): CanvasCullingSnapshot {
  return {
    culledNodeIds: new Set(),
    culledEdgeIds: new Set(),
  }
}

export function getCanvasCullingDiff(
  previous: CanvasCullingSnapshot,
  next: CanvasCullingSnapshot,
): CanvasCullingDiff {
  return {
    nodeIds: getSetDiff(previous.culledNodeIds, next.culledNodeIds),
    edgeIds: getSetDiff(previous.culledEdgeIds, next.culledEdgeIds),
  }
}

export function isCanvasCullingDiffEmpty(diff: CanvasCullingDiff): boolean {
  return diff.nodeIds.size === 0 && diff.edgeIds.size === 0
}

export function computeCanvasCullingSnapshot({
  viewport,
  surfaceBounds,
  nodeLookup,
  edges,
  selection,
  draggingNodeIds,
}: CanvasCullingState): CanvasCullingSnapshot {
  if (!surfaceBounds || surfaceBounds.width <= 0 || surfaceBounds.height <= 0) {
    return createEmptyCanvasCullingSnapshot()
  }

  const viewportBounds = getCanvasCullingViewportBounds(viewport, surfaceBounds)
  const alwaysVisibleNodeIds = getAlwaysVisibleNodeIds(selection, draggingNodeIds)
  const alwaysVisibleEdgeIds = getAlwaysVisibleEdgeIds(selection)
  const { nodeBounds, culledNodeIds } = computeNodeCulling({
    nodeLookup,
    viewportBounds,
    alwaysVisibleNodeIds,
  })
  const culledEdgeIds = computeEdgeCulling({
    edges,
    nodeBounds,
    viewportBounds,
    alwaysVisibleNodeIds,
    alwaysVisibleEdgeIds,
  })

  return { culledNodeIds, culledEdgeIds }
}

function computeNodeCulling({
  nodeLookup,
  viewportBounds,
  alwaysVisibleNodeIds,
}: {
  nodeLookup: ReadonlyMap<string, CanvasCullingNode>
  viewportBounds: Bounds
  alwaysVisibleNodeIds: ReadonlySet<string>
}) {
  const nodeBounds = new Map<string, Bounds>()
  const culledNodeIds = new Set<string>()

  for (const cullingNode of nodeLookup.values()) {
    const node = cullingNode.node
    const bounds = getNodeCullingBounds(cullingNode)
    if (!bounds) {
      continue
    }

    nodeBounds.set(node.id, bounds)
    if (
      !node.hidden &&
      !alwaysVisibleNodeIds.has(node.id) &&
      !rectIntersectsBounds(viewportBounds, bounds)
    ) {
      culledNodeIds.add(node.id)
    }
  }

  return { nodeBounds, culledNodeIds }
}

function computeEdgeCulling({
  edges,
  nodeBounds,
  viewportBounds,
  alwaysVisibleNodeIds,
  alwaysVisibleEdgeIds,
}: {
  edges: ReadonlyArray<CanvasDocumentEdge>
  nodeBounds: ReadonlyMap<string, Bounds>
  viewportBounds: Bounds
  alwaysVisibleNodeIds: ReadonlySet<string>
  alwaysVisibleEdgeIds: ReadonlySet<string>
}) {
  const culledEdgeIds = new Set<string>()

  for (const edge of edges) {
    if (
      edge.hidden ||
      alwaysVisibleEdgeIds.has(edge.id) ||
      alwaysVisibleNodeIds.has(edge.source) ||
      alwaysVisibleNodeIds.has(edge.target)
    ) {
      continue
    }

    const bounds = getEdgeCullingBounds(edge, nodeBounds)
    if (bounds && !rectIntersectsBounds(viewportBounds, bounds)) {
      culledEdgeIds.add(edge.id)
    }
  }

  return culledEdgeIds
}

function getAlwaysVisibleEdgeIds(selection: CanvasSelectionState): Set<string> {
  const ids = new Set(selection.edgeIds)
  if (selection.pendingPreview.kind === 'active') {
    for (const id of selection.pendingPreview.edgeIds) {
      ids.add(id)
    }
  }
  return ids
}

function getCanvasCullingViewportBounds(
  viewport: CanvasViewport,
  surfaceBounds: Pick<DOMRect, 'width' | 'height'>,
): Bounds {
  const zoom = Number.isFinite(viewport.zoom) && viewport.zoom > MIN_ZOOM ? viewport.zoom : MIN_ZOOM
  return {
    x: (-viewport.x - CULLING_OVERSCAN_PX) / zoom,
    y: (-viewport.y - CULLING_OVERSCAN_PX) / zoom,
    width: (surfaceBounds.width + CULLING_OVERSCAN_PX * 2) / zoom,
    height: (surfaceBounds.height + CULLING_OVERSCAN_PX * 2) / zoom,
  }
}

function getAlwaysVisibleNodeIds(
  selection: CanvasSelectionState,
  draggingNodeIds: ReadonlySet<string>,
): Set<string> {
  const ids = new Set(selection.nodeIds)
  for (const id of draggingNodeIds) {
    ids.add(id)
  }

  if (selection.pendingPreview.kind === 'active') {
    for (const id of selection.pendingPreview.nodeIds) {
      ids.add(id)
    }
  }

  return ids
}

function getNodeCullingBounds({ node, measured }: CanvasCullingNode): Bounds | null {
  const bounds = getCanvasNodeBounds(node) ?? getMeasuredCanvasNodeBounds(node, measured)
  if (!bounds) {
    return null
  }

  const padding = getNodeCullingPadding(node)
  return expandBounds(bounds, padding)
}

function getMeasuredCanvasNodeBounds(
  node: CanvasDocumentNode,
  measured: CanvasCullingNode['measured'],
): Bounds | null {
  if (
    typeof measured.width !== 'number' ||
    typeof measured.height !== 'number' ||
    !Number.isFinite(measured.width) ||
    !Number.isFinite(measured.height)
  ) {
    return null
  }

  return {
    x: node.position.x,
    y: node.position.y,
    width: measured.width,
    height: measured.height,
  }
}

function getNodeCullingPadding(node: CanvasDocumentNode): number {
  if (node.type !== 'stroke') {
    return 0
  }

  const size = parseCanvasStrokeNodeData(node.data)?.size ?? 0
  return Math.max(size, 0)
}

function getEdgeCullingBounds(
  edge: CanvasDocumentEdge,
  nodeBounds: ReadonlyMap<string, Bounds>,
): Bounds | null {
  const sourceBounds = nodeBounds.get(edge.source)
  const targetBounds = nodeBounds.get(edge.target)
  if (!sourceBounds || !targetBounds) {
    return null
  }

  const sourceCenter = getBoundsCenter(sourceBounds)
  const targetCenter = getBoundsCenter(targetBounds)
  const strokeWidth = normalizeCanvasEdgeStyle(edge.style).strokeWidth
  const padding = Math.max(strokeWidth, getCanvasEdgeInteractionWidth())

  return expandBounds(
    {
      x: Math.min(sourceCenter.x, targetCenter.x),
      y: Math.min(sourceCenter.y, targetCenter.y),
      width: Math.abs(targetCenter.x - sourceCenter.x),
      height: Math.abs(targetCenter.y - sourceCenter.y),
    },
    padding,
  )
}

function getBoundsCenter(bounds: Bounds) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
}

function expandBounds(bounds: Bounds, padding: number): Bounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  }
}

function getSetDiff(
  previous: ReadonlySet<string>,
  next: ReadonlySet<string>,
): Map<string, boolean> {
  const diff = new Map<string, boolean>()
  for (const id of previous) {
    if (!next.has(id)) {
      diff.set(id, false)
    }
  }
  for (const id of next) {
    if (!previous.has(id)) {
      diff.set(id, true)
    }
  }
  return diff
}
