import { getStrokeSelectionBounds } from './stroke/stroke-node-interactions'
import { getCanvasNodeBounds } from './shared/canvas-node-bounds'
import { getCanvasNodeModuleByType } from './canvas-node-modules'
import { boundsFromPoints, rectIntersectsBounds } from '../utils/canvas-geometry-utils'
import type { CanvasViewportTools } from '../tools/canvas-tool-types'
import type { Point2D } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-geometry-utils'
import type { CanvasNodeSelectionContext } from './canvas-node-module-types'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Node } from '@xyflow/react'

type StrokeSelectionNode = Node<
  {
    points: Array<[number, number, number]>
    size: number
    bounds: Bounds
  },
  'stroke'
>

function isStrokeSelectionNode(node: Node): node is StrokeSelectionNode {
  const bounds = node.data.bounds

  return (
    node.type === 'stroke' &&
    Array.isArray(node.data.points) &&
    typeof node.data.size === 'number' &&
    typeof bounds === 'object' &&
    bounds !== null &&
    'x' in bounds &&
    typeof bounds.x === 'number' &&
    Number.isFinite(bounds.x) &&
    'y' in bounds &&
    typeof bounds.y === 'number' &&
    Number.isFinite(bounds.y) &&
    'width' in bounds &&
    typeof bounds.width === 'number' &&
    Number.isFinite(bounds.width) &&
    'height' in bounds &&
    typeof bounds.height === 'number' &&
    Number.isFinite(bounds.height)
  )
}

function getCanvasRectangleCandidateBounds(
  node: Node,
  context: CanvasNodeSelectionContext,
): Bounds | null {
  if (isStrokeSelectionNode(node)) {
    return getStrokeSelectionBounds(node, context.zoom)
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
    if (getCanvasNodeModuleByType(node.type)?.selection?.point?.(node, point, context)) {
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
    .filter((node) =>
      getCanvasNodeModuleByType(node.type)?.selection?.rectangle?.(node, rect, context),
    )
    .map((node) => node.id)
}

export function getCanvasNodesMatchingLasso(
  nodes: Array<Node>,
  polygon: Array<Point2D>,
  context: CanvasNodeSelectionContext,
): Array<string> {
  const polygonBounds = boundsFromPoints(polygon)

  return filterCanvasSelectionCandidates(nodes, polygonBounds, getCanvasNodeBounds)
    .filter((node) =>
      getCanvasNodeModuleByType(node.type)?.selection?.lasso?.(node, polygon, context),
    )
    .map((node) => node.id)
}
