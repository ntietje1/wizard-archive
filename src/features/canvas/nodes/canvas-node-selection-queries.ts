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

function filterCanvasSelectionCandidates(
  nodes: Array<Node>,
  candidateBounds: Bounds | null,
  getBounds: (node: Node) => Bounds | null,
): Array<Node> {
  if (!candidateBounds) {
    return nodes
  }

  return nodes.filter((node) => {
    const bounds = getBounds(node)
    return !bounds || rectIntersectsBounds(candidateBounds, bounds)
  })
}

function screenEventToFlowPosition(
  context: Pick<CanvasViewportTools, 'screenToFlowPosition'>,
  event: Pick<ReactMouseEvent, 'clientX' | 'clientY'>,
): ReturnType<CanvasViewportTools['screenToFlowPosition']> {
  return context.screenToFlowPosition({
    x: event.clientX,
    y: event.clientY,
  })
}

export function findCanvasNodeAtPoint(
  nodes: Array<Node>,
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
  context: Pick<CanvasViewportTools, 'screenToFlowPosition' | 'getZoom'> & {
    getMeasuredNodes: () => Array<Node>
  },
  event: ReactMouseEvent,
): string | null {
  return findCanvasNodeAtPoint(
    context.getMeasuredNodes(),
    screenEventToFlowPosition(context, event),
    {
      zoom: context.getZoom(),
    },
  )
}

export function getCanvasNodesMatchingRectangle(
  nodes: Array<Node>,
  rect: Bounds,
  context: CanvasNodeSelectionContext,
): Array<string> {
  return filterCanvasSelectionCandidates(nodes, rect, (node) =>
    getCanvasRectangleCandidateBounds(node, context),
  )
    .filter((node) => {
      const normalizedNode = getSelectionNode(node)
      return Boolean(
        normalizedNode && matchesCanvasNodeRectangleSelection(normalizedNode, rect, context),
      )
    })
    .map((node) => node.id)
}

export function getCanvasNodesMatchingLasso(
  nodes: Array<Node>,
  polygon: Array<Point2D>,
  context: CanvasNodeSelectionContext,
): Array<string> {
  const polygonBounds = boundsFromPoints(polygon)

  return filterCanvasSelectionCandidates(nodes, polygonBounds, getCanvasNodeBounds)
    .filter((node) => {
      const normalizedNode = getSelectionNode(node)
      return Boolean(
        normalizedNode && matchesCanvasNodeLassoSelection(normalizedNode, polygon, context),
      )
    })
    .map((node) => node.id)
}
