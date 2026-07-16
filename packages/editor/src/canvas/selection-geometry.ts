import { canvasEdgePolyline } from './canvas-edge-geometry'
import type { CanvasBounds } from './canvas-bounds'
import { canvasNodeSize } from './canvas-layout'
import { canvasStrokeDocumentPoints } from './canvas-stroke-geometry'
import type { CanvasDocumentContent, CanvasDocumentNode } from './document-contract'
import { canvasPolylinesIntersect } from './polyline-geometry'
import type { CanvasPoint, CanvasSelection } from './interaction-controller'
import type { CanvasNodeId } from '../resources/domain-id'

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
    (node) => nodeIntersectsRectangle(node, bounds, zoom),
    (path) => polylineIntersectsRectangle(path, bounds),
  )
}

export function selectCanvasContentInPolygon(
  content: CanvasDocumentContent,
  polygon: ReadonlyArray<CanvasPoint>,
): CanvasSelection {
  if (polygon.length < 3) return emptySelection()
  return selectCanvasContent(
    content,
    (node) => nodeIntersectsPolygon(node, polygon),
    (path) => polylineIntersectsPolygon(path, polygon),
  )
}

function selectCanvasContent(
  content: CanvasDocumentContent,
  nodeMatches: (node: CanvasDocumentNode) => boolean,
  edgeMatches: (path: ReadonlyArray<CanvasPoint>) => boolean,
): CanvasSelection {
  const nodeIds = new Set<CanvasNodeId>()
  for (const node of content.nodes) {
    if (!node.hidden && nodeMatches(node)) nodeIds.add(node.id)
  }
  const edgeIds = new Set<string>()
  const nodesById = new Map(content.nodes.map((node) => [node.id, node]))
  for (const edge of content.edges) {
    if (edge.hidden) continue
    const path = canvasEdgePolyline(edge, nodesById)
    if (path && edgeMatches(path)) edgeIds.add(edge.id)
  }
  return { nodeIds, edgeIds }
}

function nodeIntersectsRectangle(
  node: CanvasDocumentNode,
  bounds: CanvasBounds,
  zoom: number,
): boolean {
  if (node.type !== 'stroke') return rectanglesIntersect(bounds, nodeBounds(node))
  const padding = Math.max(node.data.size / 2, STROKE_SELECTION_PADDING_PX / zoom)
  return polylineIntersectsRectangle(
    canvasStrokeDocumentPoints(node),
    expandBounds(bounds, padding),
  )
}

function nodeIntersectsPolygon(
  node: CanvasDocumentNode,
  polygon: ReadonlyArray<CanvasPoint>,
): boolean {
  return node.type === 'stroke'
    ? polylineIntersectsPolygon(canvasStrokeDocumentPoints(node), polygon)
    : polygonIntersectsRectangle(polygon, nodeBounds(node))
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
): boolean {
  if (points.some((point) => pointInRectangle(point, bounds))) return true
  const corners = rectangleCorners(bounds)
  return canvasPolylinesIntersect(points, [...corners, corners[0]])
}

function polygonIntersectsRectangle(
  polygon: ReadonlyArray<CanvasPoint>,
  bounds: CanvasBounds,
): boolean {
  const corners = rectangleCorners(bounds)
  return (
    corners.some((point) => pointInPolygon(point, polygon)) ||
    polygon.some((point) => pointInRectangle(point, bounds)) ||
    canvasPolylinesIntersect([...polygon, polygon[0]], [...corners, corners[0]])
  )
}

function polylineIntersectsPolygon(
  points: ReadonlyArray<CanvasPoint>,
  polygon: ReadonlyArray<CanvasPoint>,
): boolean {
  return (
    points.some((point) => pointInPolygon(point, polygon)) ||
    canvasPolylinesIntersect(points, [...polygon, polygon[0]])
  )
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

function pointInPolygon(point: CanvasPoint, polygon: ReadonlyArray<CanvasPoint>): boolean {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
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
