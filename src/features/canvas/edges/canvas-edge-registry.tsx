import { parseCanvasEdgeType, parseCanvasRuntimeEdge } from 'convex/canvases/validation'
import {
  bezierCanvasEdgeContainsPoint,
  bezierCanvasEdgeIntersectsPolygon,
  bezierCanvasEdgeIntersectsRectangle,
  getBezierCanvasEdgeBounds,
} from './bezier/bezier-canvas-edge-geometry'
import {
  getStepCanvasEdgeBounds,
  stepCanvasEdgeContainsPoint,
  stepCanvasEdgeIntersectsPolygon,
  stepCanvasEdgeIntersectsRectangle,
} from './step/step-canvas-edge-geometry'
import {
  getStraightCanvasEdgeBounds,
  straightCanvasEdgeContainsPoint,
  straightCanvasEdgeIntersectsPolygon,
  straightCanvasEdgeIntersectsRectangle,
} from './straight/straight-canvas-edge-geometry'
import { normalizeCanvasEdgeStyle } from './shared/canvas-edge-style'
import { getCanvasStrokeEdgeProperties } from './shared/canvas-edge-properties'
import { createCanvasNodesById } from './shared/canvas-node-map'
import { boundsFromPoints, rectIntersectsBounds } from '../utils/canvas-geometry-utils'
import { EMPTY_CANVAS_INSPECTABLE_PROPERTIES } from '../properties/canvas-property-types'
import type {
  CanvasEdgePatch,
  CanvasEdgeSelectionContext,
  CanvasEdgeType,
  CanvasRuntimeEdge,
} from './canvas-edge-types'
import type { CanvasInspectableProperties } from '../properties/canvas-property-types'
import type { CanvasContextMenuContributor } from '../runtime/context-menu/canvas-context-menu-types'
import type { Point2D } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-geometry-utils'
import type {
  CanvasEdge as Edge,
  CanvasNode as Node,
} from '~/features/canvas/types/canvas-domain-types'

const EMPTY_CONTEXT_MENU_CONTRIBUTORS: ReadonlyArray<CanvasContextMenuContributor> = []

type NormalizedCanvasEdgeEntry = {
  rawEdge: Edge
  edge: CanvasRuntimeEdge
}

export function resolveCanvasEdgeType(type: string | undefined): CanvasEdgeType {
  return parseCanvasEdgeType(type) ?? 'bezier'
}

function createCanvasEdgeSelectionContext(
  nodes: ReadonlyArray<Node>,
  zoom: number,
): CanvasEdgeSelectionContext {
  return {
    nodesById: createCanvasNodesById(nodes),
    zoom,
  }
}

export function normalizeCanvasEdge(edge: Edge): CanvasRuntimeEdge | null {
  const parsedEdge = parseCanvasRuntimeEdge({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: resolveCanvasEdgeType(edge.type),
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    style: edge.style,
  })
  if (!parsedEdge) {
    return null
  }

  return {
    ...parsedEdge,
    style: normalizeCanvasEdgeStyle(parsedEdge.style),
  }
}

function normalizeCanvasEdges(edges: ReadonlyArray<Edge>): Array<NormalizedCanvasEdgeEntry> {
  return edges.flatMap((rawEdge) => {
    const edge = normalizeCanvasEdge(rawEdge)
    return edge ? [{ rawEdge, edge }] : []
  })
}

type CanvasEdgeSpec = {
  contextMenuContributors: ReadonlyArray<CanvasContextMenuContributor>
  getBounds: (edge: CanvasRuntimeEdge, context: CanvasEdgeSelectionContext) => Bounds | null
  containsPoint: (
    edge: CanvasRuntimeEdge,
    point: Point2D,
    context: CanvasEdgeSelectionContext,
  ) => boolean
  intersectsRectangle: (
    edge: CanvasRuntimeEdge,
    rect: Bounds,
    context: CanvasEdgeSelectionContext,
  ) => boolean
  intersectsPolygon: (
    edge: CanvasRuntimeEdge,
    polygon: ReadonlyArray<Point2D>,
    context: CanvasEdgeSelectionContext,
  ) => boolean
  getProperties: (
    edge: CanvasRuntimeEdge,
    patchEdge: (edgeId: string, patch: CanvasEdgePatch) => void,
  ) => CanvasInspectableProperties
}

export const canvasEdgeSpecs = {
  bezier: {
    contextMenuContributors: EMPTY_CONTEXT_MENU_CONTRIBUTORS,
    getBounds: (edge, context) => getBezierCanvasEdgeBounds(edge, context.nodesById),
    containsPoint: (edge, point, context) =>
      bezierCanvasEdgeContainsPoint(edge, point, context.nodesById, context.zoom),
    intersectsRectangle: (edge, rect, context) =>
      bezierCanvasEdgeIntersectsRectangle(edge, rect, context.nodesById),
    intersectsPolygon: (edge, polygon, context) =>
      bezierCanvasEdgeIntersectsPolygon(edge, polygon, context.nodesById),
    getProperties: getCanvasStrokeEdgeProperties,
  },
  straight: {
    contextMenuContributors: EMPTY_CONTEXT_MENU_CONTRIBUTORS,
    getBounds: (edge, context) => getStraightCanvasEdgeBounds(edge, context.nodesById),
    containsPoint: (edge, point, context) =>
      straightCanvasEdgeContainsPoint(edge, point, context.nodesById, context.zoom),
    intersectsRectangle: (edge, rect, context) =>
      straightCanvasEdgeIntersectsRectangle(edge, rect, context.nodesById),
    intersectsPolygon: (edge, polygon, context) =>
      straightCanvasEdgeIntersectsPolygon(edge, polygon, context.nodesById),
    getProperties: getCanvasStrokeEdgeProperties,
  },
  step: {
    contextMenuContributors: EMPTY_CONTEXT_MENU_CONTRIBUTORS,
    getBounds: (edge, context) => getStepCanvasEdgeBounds(edge, context.nodesById),
    containsPoint: (edge, point, context) =>
      stepCanvasEdgeContainsPoint(edge, point, context.nodesById, context.zoom),
    intersectsRectangle: (edge, rect, context) =>
      stepCanvasEdgeIntersectsRectangle(edge, rect, context.nodesById),
    intersectsPolygon: (edge, polygon, context) =>
      stepCanvasEdgeIntersectsPolygon(edge, polygon, context.nodesById),
    getProperties: getCanvasStrokeEdgeProperties,
  },
} as const satisfies Record<CanvasEdgeType, CanvasEdgeSpec>

function getCanvasEdgeSpec(edge: CanvasRuntimeEdge): CanvasEdgeSpec {
  return canvasEdgeSpecs[edge.type]
}

export function getCanvasEdgeInspectableProperties(
  edge: CanvasRuntimeEdge | null,
  patchEdge: (edgeId: string, patch: CanvasEdgePatch) => void,
): CanvasInspectableProperties {
  if (!edge) {
    return EMPTY_CANVAS_INSPECTABLE_PROPERTIES
  }

  return getCanvasEdgeSpec(edge).getProperties(edge, patchEdge)
}

function isCanvasEdgeSelectionCandidate(
  edge: CanvasRuntimeEdge,
  candidateBounds: Bounds | null,
  context: CanvasEdgeSelectionContext,
): boolean {
  if (!candidateBounds) {
    return true
  }

  const bounds = getCanvasEdgeSpec(edge).getBounds(edge, context)
  return !bounds || rectIntersectsBounds(candidateBounds, bounds)
}

export function findCanvasEdgeAtPoint(
  nodes: Array<Node>,
  edges: Array<Edge>,
  point: Point2D,
  context: Pick<CanvasEdgeSelectionContext, 'zoom'>,
): string | null {
  const selectionContext = createCanvasEdgeSelectionContext(nodes, context.zoom)
  const normalizedEdges = normalizeCanvasEdges(edges)

  for (let index = normalizedEdges.length - 1; index >= 0; index -= 1) {
    const { rawEdge, edge } = normalizedEdges[index]
    if (getCanvasEdgeSpec(edge).containsPoint(edge, point, selectionContext)) {
      return rawEdge.id
    }
  }

  return null
}

export function getCanvasEdgesMatchingRectangle(
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
  rect: Bounds,
  context: Pick<CanvasEdgeSelectionContext, 'zoom'>,
): ReadonlySet<string> {
  const selectionContext = createCanvasEdgeSelectionContext(nodes, context.zoom)
  const normalizedEdges = normalizeCanvasEdges(edges)
  const matchingIds = new Set<string>()

  for (const { rawEdge, edge } of normalizedEdges) {
    if (
      isCanvasEdgeSelectionCandidate(edge, rect, selectionContext) &&
      getCanvasEdgeSpec(edge).intersectsRectangle(edge, rect, selectionContext)
    ) {
      matchingIds.add(rawEdge.id)
    }
  }

  return matchingIds
}

export function getCanvasEdgesMatchingLasso(
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
  polygon: ReadonlyArray<Point2D>,
  context: Pick<CanvasEdgeSelectionContext, 'zoom'>,
): ReadonlySet<string> {
  const selectionContext = createCanvasEdgeSelectionContext(nodes, context.zoom)
  const polygonBounds = boundsFromPoints(polygon)
  const normalizedEdges = normalizeCanvasEdges(edges)
  const matchingIds = new Set<string>()

  for (const { rawEdge, edge } of normalizedEdges) {
    if (
      isCanvasEdgeSelectionCandidate(edge, polygonBounds, selectionContext) &&
      getCanvasEdgeSpec(edge).intersectsPolygon(edge, polygon, selectionContext)
    ) {
      matchingIds.add(rawEdge.id)
    }
  }

  return matchingIds
}
