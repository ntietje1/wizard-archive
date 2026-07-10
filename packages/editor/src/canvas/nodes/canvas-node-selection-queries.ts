import { parseCanvasStrokeSelectionData } from '../geometry'
import { getStrokeSelectionBounds } from './stroke/stroke-node-interactions'
import { getCanvasNodeBounds } from './shared/canvas-node-bounds'
import {
  matchesCanvasNodeLassoSelection,
  matchesCanvasNodeRectangleSelection,
} from './canvas-node-modules'
import { normalizeCanvasNode } from './canvas-node-normalization'
import type { AnyNormalizedCanvasNode } from './canvas-node-normalization'
import { boundsFromPoints, rectIntersectsBounds } from '../utils/canvas-geometry-utils'
import type { Point2D } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-geometry-utils'
import type { CanvasNodeSelectionContext } from './canvas-node-types'
import type { CanvasDocumentNode } from '../document-contract'

function getStrokeSelectionCandidateBounds(
  node: CanvasDocumentNode,
  context: CanvasNodeSelectionContext,
): Bounds | null {
  if (node.type !== 'stroke') {
    return null
  }

  const parsedStrokeData = parseCanvasStrokeSelectionData(node.data)
  if (!parsedStrokeData) {
    return null
  }

  return getStrokeSelectionBounds(
    {
      position: node.position,
      data: parsedStrokeData,
    },
    context.zoom,
  )
}

function getCanvasRectangleCandidateBounds(
  node: CanvasDocumentNode,
  context: CanvasNodeSelectionContext,
): Bounds | null {
  const strokeBounds = getStrokeSelectionCandidateBounds(node, context)
  if (strokeBounds) {
    return strokeBounds
  }

  return getCanvasNodeBounds(node)
}

function isCanvasSelectionCandidate(
  node: CanvasDocumentNode,
  candidateBounds: Bounds | null,
  getBounds: (node: CanvasDocumentNode) => Bounds | null,
): boolean {
  if (!candidateBounds) {
    return true
  }

  const bounds = getBounds(node)
  return !bounds || rectIntersectsBounds(candidateBounds, bounds)
}

export function getCanvasNodesMatchingRectangle(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  rect: Bounds,
  context: CanvasNodeSelectionContext,
): ReadonlySet<string> {
  return getCanvasNodesMatchingSelection(nodes, rect, context, (node) =>
    matchesCanvasNodeRectangleSelection(node, rect, context),
  )
}

export function getCanvasNodesMatchingLasso(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  polygon: ReadonlyArray<Point2D>,
  context: CanvasNodeSelectionContext,
): ReadonlySet<string> {
  const polygonBounds = boundsFromPoints(polygon)
  return getCanvasNodesMatchingSelection(nodes, polygonBounds, context, (node) =>
    matchesCanvasNodeLassoSelection(node, polygon, context),
  )
}

function getCanvasNodesMatchingSelection(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  candidateBounds: Bounds | null,
  context: CanvasNodeSelectionContext,
  matchesSelection: (node: AnyNormalizedCanvasNode) => boolean,
): ReadonlySet<string> {
  const matchingIds = new Set<string>()
  const getBounds = (candidate: CanvasDocumentNode) =>
    getCanvasRectangleCandidateBounds(candidate, context)

  for (const node of nodes) {
    if (!isCanvasSelectionCandidate(node, candidateBounds, getBounds)) {
      continue
    }

    const normalizedNode = normalizeCanvasNode(node)
    if (normalizedNode && matchesSelection(normalizedNode)) {
      matchingIds.add(node.id)
    }
  }

  return matchingIds
}
