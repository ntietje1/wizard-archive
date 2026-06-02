import { parseCanvasStrokeSelectionData } from '~/features/canvas/domain/validation'
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
import type { CanvasDocumentNode } from '~/features/canvas/domain/validation'

function getSelectionNode(node: CanvasDocumentNode): AnyNormalizedCanvasNode | null {
  return normalizeCanvasNode(node)
}

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
  const matchingIds = new Set<string>()
  const getBounds = (candidate: CanvasDocumentNode) =>
    getCanvasRectangleCandidateBounds(candidate, context)
  for (const node of nodes) {
    if (!isCanvasSelectionCandidate(node, rect, getBounds)) {
      continue
    }

    const normalizedNode = getSelectionNode(node)
    if (normalizedNode && matchesCanvasNodeRectangleSelection(normalizedNode, rect, context)) {
      matchingIds.add(node.id)
    }
  }

  return matchingIds
}

export function getCanvasNodesMatchingLasso(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  polygon: ReadonlyArray<Point2D>,
  context: CanvasNodeSelectionContext,
): ReadonlySet<string> {
  const polygonBounds = boundsFromPoints(polygon)
  const matchingIds = new Set<string>()

  for (const node of nodes) {
    if (!isCanvasSelectionCandidate(node, polygonBounds, getCanvasNodeBounds)) {
      continue
    }

    const normalizedNode = getSelectionNode(node)
    if (normalizedNode && matchesCanvasNodeLassoSelection(normalizedNode, polygon, context)) {
      matchingIds.add(node.id)
    }
  }

  return matchingIds
}
