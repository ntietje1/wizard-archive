import { canvasEdgePolyline } from './canvas-edge-geometry'
import type { CanvasBounds } from './canvas-bounds'
import { canvasNodeSize } from './canvas-layout'
import { canvasStrokeDocumentPoints } from './canvas-stroke-geometry'
import type { CanvasDocumentContent, CanvasDocumentNode } from './document-contract'
import { canvasPolylinesIntersect } from './polyline-geometry'
import type { CanvasPoint, CanvasSelection } from './interaction-types'
import type { CanvasNodeId } from '../resources/domain-id'
import { CANVAS_WORKLOAD_LIMITS } from './workload'
import { createCanvasBoundsIndex } from './bounds-index'

const STROKE_SELECTION_PADDING_PX = 12

type CanvasSelectionNodeCandidate = Readonly<{
  node: CanvasDocumentNode
  bounds: CanvasBounds
}>

type CanvasSelectionEdgeCandidate = Readonly<{
  id: string
  path: ReadonlyArray<CanvasPoint>
}>

export function createCanvasSelectionCandidateIndex(content: CanvasDocumentContent) {
  const nodesById = new Map(content.nodes.map((node) => [node.id, node]))
  const nodes = content.nodes.flatMap((node) => {
    if (node.hidden) return []
    return [{ node, bounds: nodeBounds(node) }]
  })
  const edges = content.edges.flatMap((edge) => {
    if (edge.hidden) return []
    const path = canvasEdgePolyline(edge, nodesById)
    return path ? [{ id: edge.id, path }] : []
  })
  const nodeIndex = createCanvasBoundsIndex(
    nodes.map((candidate) => ({ bounds: candidate.bounds, value: candidate })),
  )
  const edgeIndex = createCanvasBoundsIndex(
    edges.map((candidate) => ({ bounds: pointsBounds(candidate.path), value: candidate })),
  )
  const strokePadding = Math.max(
    0,
    ...nodes.map(({ node }) => (node.type === 'stroke' ? node.data.size / 2 : 0)),
  )
  const select = (
    queryBounds: CanvasBounds,
    nodeMatches: (candidate: CanvasSelectionNodeCandidate) => boolean,
    edgeMatches: (candidate: CanvasSelectionEdgeCandidate) => boolean,
  ): CanvasSelection => {
    const nodeCandidates = nodeIndex.query(queryBounds)
    const nodeIds = new Set<CanvasNodeId>()
    for (const candidate of nodeCandidates) {
      if (nodeMatches(candidate)) nodeIds.add(candidate.node.id)
      if (nodeIds.size === CANVAS_WORKLOAD_LIMITS.selectedElements) break
    }
    if (nodeIds.size === CANVAS_WORKLOAD_LIMITS.selectedElements) {
      return { nodeIds, edgeIds: new Set() }
    }
    const edgeCandidates = edgeIndex.query(queryBounds)
    const edgeIds = new Set<string>()
    for (const candidate of edgeCandidates) {
      if (edgeMatches(candidate)) edgeIds.add(candidate.id)
      if (nodeIds.size + edgeIds.size === CANVAS_WORKLOAD_LIMITS.selectedElements) break
    }
    return { nodeIds, edgeIds }
  }
  return {
    rectangle(bounds: CanvasBounds, zoom: number): CanvasSelection {
      const queryBounds = expandBounds(
        bounds,
        Math.max(strokePadding, STROKE_SELECTION_PADDING_PX / zoom),
      )
      return select(
        queryBounds,
        (candidate) => nodeIntersectsRectangle(candidate.node, bounds, zoom),
        (candidate) => polylineIntersectsRectangle(candidate.path, bounds),
      )
    },
    polygon(polygon: ReadonlyArray<CanvasPoint>): CanvasSelection {
      if (polygon.length < 3) return emptySelection()
      const queryBounds = expandBounds(pointsBounds(polygon), strokePadding)
      return select(
        queryBounds,
        (candidate) => nodeIntersectsPolygon(candidate.node, polygon),
        (candidate) => polylineIntersectsPolygon(candidate.path, polygon),
      )
    },
  }
}

export function canvasBoundsFromPoints(start: CanvasPoint, end: CanvasPoint): CanvasBounds {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
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
  if (anyPointInRectangle(points, bounds)) return true
  const corners = rectangleCorners(bounds)
  return canvasPolylinesIntersect(points, [...corners, corners[0]])
}

function polygonIntersectsRectangle(
  polygon: ReadonlyArray<CanvasPoint>,
  bounds: CanvasBounds,
): boolean {
  const corners = rectangleCorners(bounds)
  return (
    anyPointInPolygon(corners, polygon) ||
    anyPointInRectangle(polygon, bounds) ||
    canvasPolylinesIntersect([...polygon, polygon[0]], [...corners, corners[0]])
  )
}

function polylineIntersectsPolygon(
  points: ReadonlyArray<CanvasPoint>,
  polygon: ReadonlyArray<CanvasPoint>,
): boolean {
  return (
    anyPointInPolygon(points, polygon) || canvasPolylinesIntersect(points, [...polygon, polygon[0]])
  )
}

function anyPointInRectangle(points: ReadonlyArray<CanvasPoint>, bounds: CanvasBounds): boolean {
  for (const point of points) {
    if (pointInRectangle(point, bounds)) return true
  }
  return false
}

function anyPointInPolygon(
  points: ReadonlyArray<CanvasPoint>,
  polygon: ReadonlyArray<CanvasPoint>,
): boolean {
  for (const point of points) {
    if (pointInPolygon(point, polygon)) return true
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

function pointsBounds(points: ReadonlyArray<CanvasPoint>): CanvasBounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
