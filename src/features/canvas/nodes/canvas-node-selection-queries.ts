import { parseCanvasStrokeSelectionData } from 'convex/canvases/validation'
import { getStrokeSelectionBounds } from './stroke/stroke-node-interactions'
import { getCanvasNodeBounds } from './shared/canvas-node-bounds'
import {
  matchesCanvasNodeLassoSelection,
  matchesCanvasNodePointSelection,
  matchesCanvasNodeRectangleSelection,
  normalizeCanvasNode,
} from './canvas-node-modules'
import type { AnyNormalizedCanvasNode } from './canvas-node-modules'
import { boundsFromPoints, rectIntersectsBounds } from '../utils/canvas-geometry-utils'
import type { CanvasViewportTools } from '../tools/canvas-tool-types'
import type { Point2D } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-geometry-utils'
import type { CanvasNodeSelectionContext } from './canvas-node-types'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Node } from '@xyflow/react'

function getSelectionNode(node: Node): AnyNormalizedCanvasNode | null {
  return normalizeCanvasNode(node)
}

function getStrokeSelectionCandidateBounds(
  node: Node,
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
  node: Node,
  context: CanvasNodeSelectionContext,
): Bounds | null {
  const strokeBounds = getStrokeSelectionCandidateBounds(node, context)
  if (strokeBounds) {
    return strokeBounds
  }

  return getCanvasNodeBounds(node)
}

function isCanvasSelectionCandidate(
  node: Node,
  candidateBounds: Bounds | null,
  getBounds: (node: Node) => Bounds | null,
): boolean {
  if (!candidateBounds) {
    return true
  }

  const bounds = getBounds(node)
  return !bounds || rectIntersectsBounds(candidateBounds, bounds)
}

function screenEventToCanvasPosition(
  context: Pick<CanvasViewportTools, 'screenToCanvasPosition'>,
  event: Pick<ReactMouseEvent, 'clientX' | 'clientY'>,
): ReturnType<CanvasViewportTools['screenToCanvasPosition']> {
  return context.screenToCanvasPosition({
    x: event.clientX,
    y: event.clientY,
  })
}

export function findCanvasNodeAtPoint(
  nodes: ReadonlyArray<Node>,
  point: Point2D,
  context: CanvasNodeSelectionContext,
): string | null {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    const normalizedNode = getSelectionNode(node)
    if (normalizedNode && matchesCanvasNodePointSelection(normalizedNode, point, context)) {
      return node.id
    }
  }

  return null
}

export function hitTestCanvasNode(
  context: Pick<CanvasViewportTools, 'screenToCanvasPosition' | 'getZoom'> & {
    getMeasuredNodes: () => Array<Node>
  },
  event: ReactMouseEvent,
): string | null {
  return findCanvasNodeAtPoint(
    context.getMeasuredNodes(),
    screenEventToCanvasPosition(context, event),
    {
      zoom: context.getZoom(),
    },
  )
}

export function getCanvasNodesMatchingRectangle(
  nodes: ReadonlyArray<Node>,
  rect: Bounds,
  context: CanvasNodeSelectionContext,
): ReadonlySet<string> {
  const matchingIds = new Set<string>()
  const getBounds = (candidate: Node) => getCanvasRectangleCandidateBounds(candidate, context)
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
  nodes: ReadonlyArray<Node>,
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
