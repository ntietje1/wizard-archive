import { parseCanvasDocumentEdge, parseCanvasEdgeType } from 'convex/canvases/validation'
import { buildBezierCanvasEdgeGeometryFromEdge } from './bezier/bezier-canvas-edge-geometry'
import { buildStepCanvasEdgeGeometryFromEdge } from './step/step-canvas-edge-geometry'
import { buildStraightCanvasEdgeGeometryFromEdge } from './straight/straight-canvas-edge-geometry'
import {
  canvasEdgeGeometryContainsPoint,
  canvasEdgeGeometryIntersectsPolygon,
  canvasEdgeGeometryIntersectsRectangle,
  getCanvasEdgeGeometryBounds,
} from './shared/canvas-edge-geometry'
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
import type { CanvasEdgeGeometry } from './shared/canvas-edge-geometry'
import type { CanvasInspectableProperties } from '../properties/canvas-property-types'
import type { Point2D } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-geometry-utils'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/types/canvas-domain-types'

type NormalizedCanvasEdgeEntry = {
  rawEdge: CanvasDocumentEdge
  edge: CanvasRuntimeEdge
}

export function resolveCanvasEdgeType(type: string | undefined): CanvasEdgeType {
  return parseCanvasEdgeType(type) ?? 'bezier'
}

function createCanvasEdgeSelectionContext(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  zoom: number,
): CanvasEdgeSelectionContext {
  return {
    nodesById: createCanvasNodesById(nodes),
    zoom,
  }
}

export function normalizeCanvasEdge(edge: CanvasDocumentEdge): CanvasRuntimeEdge | null {
  const parsedEdge = parseCanvasDocumentEdge({
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

function normalizeCanvasEdges(
  edges: ReadonlyArray<CanvasDocumentEdge>,
): Array<NormalizedCanvasEdgeEntry> {
  return edges.flatMap((rawEdge) => {
    const edge = normalizeCanvasEdge(rawEdge)
    return edge ? [{ rawEdge, edge }] : []
  })
}

type CanvasEdgeSpec = {
  buildGeometry: (
    edge: CanvasRuntimeEdge,
    nodesById: ReadonlyMap<string, CanvasDocumentNode>,
  ) => CanvasEdgeGeometry | null
  getProperties: (
    edge: CanvasRuntimeEdge,
    patchEdge: (edgeId: string, patch: CanvasEdgePatch) => void,
  ) => CanvasInspectableProperties
}

const canvasEdgeSpecs = {
  bezier: {
    buildGeometry: buildBezierCanvasEdgeGeometryFromEdge,
    getProperties: getCanvasStrokeEdgeProperties,
  },
  straight: {
    buildGeometry: buildStraightCanvasEdgeGeometryFromEdge,
    getProperties: getCanvasStrokeEdgeProperties,
  },
  step: {
    buildGeometry: buildStepCanvasEdgeGeometryFromEdge,
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

export function buildCanvasEdgeGeometry(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<string, CanvasDocumentNode>,
): CanvasEdgeGeometry | null {
  const normalizedEdge = normalizeCanvasEdge(edge)
  return normalizedEdge
    ? getCanvasEdgeSpec(normalizedEdge).buildGeometry(normalizedEdge, nodesById)
    : null
}

function isCanvasEdgeSelectionCandidate(
  geometry: CanvasEdgeGeometry,
  candidateBounds: Bounds | null,
): boolean {
  if (!candidateBounds) {
    return true
  }

  const bounds = getCanvasEdgeGeometryBounds(geometry)
  return !bounds || rectIntersectsBounds(candidateBounds, bounds)
}

export function findCanvasEdgeAtPoint(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  edges: ReadonlyArray<CanvasDocumentEdge>,
  point: Point2D,
  context: Pick<CanvasEdgeSelectionContext, 'zoom'>,
): string | null {
  const selectionContext = createCanvasEdgeSelectionContext(nodes, context.zoom)
  const normalizedEdges = normalizeCanvasEdges(edges)

  for (let index = normalizedEdges.length - 1; index >= 0; index -= 1) {
    const { rawEdge, edge } = normalizedEdges[index]
    const geometry = getCanvasEdgeSpec(edge).buildGeometry(edge, selectionContext.nodesById)
    if (geometry && canvasEdgeGeometryContainsPoint(geometry, point, selectionContext.zoom)) {
      return rawEdge.id
    }
  }

  return null
}

export function getCanvasEdgesMatchingRectangle(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  edges: ReadonlyArray<CanvasDocumentEdge>,
  rect: Bounds,
  context: Pick<CanvasEdgeSelectionContext, 'zoom'>,
): ReadonlySet<string> {
  const selectionContext = createCanvasEdgeSelectionContext(nodes, context.zoom)
  const normalizedEdges = normalizeCanvasEdges(edges)
  const matchingIds = new Set<string>()

  for (const { rawEdge, edge } of normalizedEdges) {
    const geometry = getCanvasEdgeSpec(edge).buildGeometry(edge, selectionContext.nodesById)
    if (
      geometry &&
      isCanvasEdgeSelectionCandidate(geometry, rect) &&
      canvasEdgeGeometryIntersectsRectangle(geometry, rect)
    ) {
      matchingIds.add(rawEdge.id)
    }
  }

  return matchingIds
}

export function getCanvasEdgesMatchingLasso(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  edges: ReadonlyArray<CanvasDocumentEdge>,
  polygon: ReadonlyArray<Point2D>,
  context: Pick<CanvasEdgeSelectionContext, 'zoom'>,
): ReadonlySet<string> {
  const selectionContext = createCanvasEdgeSelectionContext(nodes, context.zoom)
  const polygonBounds = boundsFromPoints(polygon)
  const normalizedEdges = normalizeCanvasEdges(edges)
  const matchingIds = new Set<string>()

  for (const { rawEdge, edge } of normalizedEdges) {
    const geometry = getCanvasEdgeSpec(edge).buildGeometry(edge, selectionContext.nodesById)
    if (
      geometry &&
      isCanvasEdgeSelectionCandidate(geometry, polygonBounds) &&
      canvasEdgeGeometryIntersectsPolygon(geometry, polygon)
    ) {
      matchingIds.add(rawEdge.id)
    }
  }

  return matchingIds
}
