import { canvasEdgePolyline } from './canvas-edge-geometry'
import type { CanvasBounds } from './canvas-bounds'
import { canvasNodeSize } from './canvas-layout'
import { canvasStrokeDocumentPoints } from './canvas-stroke-geometry'
import type { CanvasDocumentContent, CanvasDocumentNode } from './document-contract'
import { canvasPolylinesIntersect } from './polyline-geometry'
import type { CanvasPoint, CanvasSelection } from './interaction-controller'
import type { CanvasNodeId } from '../resources/domain-id'
import {
  CANVAS_WORKLOAD_LIMITS,
  consumeCanvasCandidateWork,
  createCanvasCandidateWorkBudget,
} from './workload'
import type { CanvasCandidateWorkBudget } from './workload'

const STROKE_SELECTION_PADDING_PX = 12

export function canvasBoundsFromPoints(start: CanvasPoint, end: CanvasPoint): CanvasBounds {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

export function selectCanvasContentInRectangle(
  content: CanvasDocumentContent,
  bounds: CanvasBounds,
  zoom: number,
): CanvasSelection {
  return selectCanvasContent(
    content,
    (node, budget) => nodeIntersectsRectangle(node, bounds, zoom, budget),
    (path, budget) => polylineIntersectsRectangle(path, bounds, budget),
  )
}

export function selectCanvasContentInPolygon(
  content: CanvasDocumentContent,
  polygon: ReadonlyArray<CanvasPoint>,
): CanvasSelection {
  if (polygon.length < 3) return emptySelection()
  return selectCanvasContent(
    content,
    (node, budget) => nodeIntersectsPolygon(node, polygon, budget),
    (path, budget) => polylineIntersectsPolygon(path, polygon, budget),
  )
}

function selectCanvasContent(
  content: CanvasDocumentContent,
  nodeMatches: (node: CanvasDocumentNode, budget: CanvasCandidateWorkBudget) => boolean,
  edgeMatches: (path: ReadonlyArray<CanvasPoint>, budget: CanvasCandidateWorkBudget) => boolean,
): CanvasSelection {
  const budget = createCanvasCandidateWorkBudget()
  const nodeIds = new Set<CanvasNodeId>()
  for (const node of content.nodes) {
    if (!node.hidden && nodeMatches(node, budget)) nodeIds.add(node.id)
    if (nodeIds.size === CANVAS_WORKLOAD_LIMITS.selectedElements) break
  }
  const edgeIds = new Set<string>()
  const nodesById = new Map(content.nodes.map((node) => [node.id, node]))
  for (const edge of content.edges) {
    if (nodeIds.size + edgeIds.size === CANVAS_WORKLOAD_LIMITS.selectedElements) break
    if (edge.hidden) continue
    const path = canvasEdgePolyline(edge, nodesById)
    if (path && edgeMatches(path, budget)) edgeIds.add(edge.id)
  }
  return { nodeIds, edgeIds }
}

function nodeIntersectsRectangle(
  node: CanvasDocumentNode,
  bounds: CanvasBounds,
  zoom: number,
  budget: CanvasCandidateWorkBudget,
): boolean {
  if (node.type !== 'stroke') return rectanglesIntersect(bounds, nodeBounds(node))
  const padding = Math.max(node.data.size / 2, STROKE_SELECTION_PADDING_PX / zoom)
  return polylineIntersectsRectangle(
    canvasStrokeDocumentPoints(node),
    expandBounds(bounds, padding),
    budget,
  )
}

function nodeIntersectsPolygon(
  node: CanvasDocumentNode,
  polygon: ReadonlyArray<CanvasPoint>,
  budget: CanvasCandidateWorkBudget,
): boolean {
  return node.type === 'stroke'
    ? polylineIntersectsPolygon(canvasStrokeDocumentPoints(node), polygon, budget)
    : polygonIntersectsRectangle(polygon, nodeBounds(node), budget)
}

function nodeBounds(node: CanvasDocumentNode): CanvasBounds {
  const size = canvasNodeSize(node)
  return { ...node.position, ...size }
}

function emptySelection(): CanvasSelection {
  return { nodeIds: new Set(), edgeIds: new Set() }
}

function expandBounds(bounds: CanvasBounds, padding: number): CanvasBounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  }
}

function rectanglesIntersect(left: CanvasBounds, right: CanvasBounds): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  )
}

function pointInRectangle(point: CanvasPoint, bounds: CanvasBounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}

function polylineIntersectsRectangle(
  points: ReadonlyArray<CanvasPoint>,
  bounds: CanvasBounds,
  budget: CanvasCandidateWorkBudget,
): boolean {
  if (anyPointInRectangle(points, bounds, budget)) return true
  const corners = rectangleCorners(bounds)
  return canvasPolylinesIntersect(points, [...corners, corners[0]], budget)
}

function polygonIntersectsRectangle(
  polygon: ReadonlyArray<CanvasPoint>,
  bounds: CanvasBounds,
  budget: CanvasCandidateWorkBudget,
): boolean {
  const corners = rectangleCorners(bounds)
  return (
    anyPointInPolygon(corners, polygon, budget) ||
    anyPointInRectangle(polygon, bounds, budget) ||
    canvasPolylinesIntersect([...polygon, polygon[0]], [...corners, corners[0]], budget)
  )
}

function polylineIntersectsPolygon(
  points: ReadonlyArray<CanvasPoint>,
  polygon: ReadonlyArray<CanvasPoint>,
  budget: CanvasCandidateWorkBudget,
): boolean {
  return (
    anyPointInPolygon(points, polygon, budget) ||
    canvasPolylinesIntersect(points, [...polygon, polygon[0]], budget)
  )
}

function anyPointInRectangle(
  points: ReadonlyArray<CanvasPoint>,
  bounds: CanvasBounds,
  budget: CanvasCandidateWorkBudget,
): boolean {
  for (const point of points) {
    if (!consumeCanvasCandidateWork(budget)) return false
    if (pointInRectangle(point, bounds)) return true
  }
  return false
}

function anyPointInPolygon(
  points: ReadonlyArray<CanvasPoint>,
  polygon: ReadonlyArray<CanvasPoint>,
  budget: CanvasCandidateWorkBudget,
): boolean {
  for (const point of points) {
    if (budget.remaining === 0) return false
    if (pointInPolygon(point, polygon, budget)) return true
  }
  return false
}

function rectangleCorners(
  bounds: CanvasBounds,
): [CanvasPoint, CanvasPoint, CanvasPoint, CanvasPoint] {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ]
}

function pointInPolygon(
  point: CanvasPoint,
  polygon: ReadonlyArray<CanvasPoint>,
  budget: CanvasCandidateWorkBudget,
): boolean {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    if (!consumeCanvasCandidateWork(budget)) return false
    const currentPoint = polygon[index]
    const previousPoint = polygon[previous]
    if (
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x
    ) {
      inside = !inside
    }
  }
  return inside
}
