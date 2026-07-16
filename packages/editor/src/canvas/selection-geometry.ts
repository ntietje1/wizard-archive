import { canvasEdgePolyline } from './canvas-edge-geometry'
import type { CanvasBounds } from './canvas-bounds'
import { canvasNodeSize } from './canvas-layout'
import { canvasStrokeDocumentPoints } from './canvas-stroke-geometry'
import type { CanvasDocumentContent, CanvasDocumentNode } from './document-contract'
import { canvasPolylinesIntersect } from './polyline-geometry'
import type { CanvasPoint, CanvasSelection } from './interaction-types'
import type { CanvasNodeId } from '../resources/domain-id'
import { CANVAS_WORKLOAD_LIMITS } from './workload'
import type { CanvasCandidateWorkBudget } from './workload'
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

type CanvasSelectionQuery = Readonly<{
  selection: CanvasSelection
  exhausted: boolean
  visited: number
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
    budget: CanvasCandidateWorkBudget,
  ): CanvasSelectionQuery => {
    const nodeQuery = nodeIndex.query(queryBounds, budget)
    const nodeIds = new Set<CanvasNodeId>()
    for (const candidate of nodeQuery.values) {
      if (nodeMatches(candidate)) nodeIds.add(candidate.node.id)
      if (nodeIds.size === CANVAS_WORKLOAD_LIMITS.selectedElements || budget.exhausted) break
    }
    if (nodeIds.size === CANVAS_WORKLOAD_LIMITS.selectedElements || budget.exhausted) {
      return {
        selection: { nodeIds, edgeIds: new Set() },
        exhausted: budget.exhausted,
        visited: nodeQuery.visited,
      }
    }
    const edgeQuery = edgeIndex.query(queryBounds, budget)
    const edgeIds = new Set<string>()
    for (const candidate of edgeQuery.values) {
      if (edgeMatches(candidate)) edgeIds.add(candidate.id)
      if (
        nodeIds.size + edgeIds.size === CANVAS_WORKLOAD_LIMITS.selectedElements ||
        budget.exhausted
      ) {
        break
      }
    }
    return {
      selection: { nodeIds, edgeIds },
      exhausted: budget.exhausted,
      visited: nodeQuery.visited + edgeQuery.visited,
    }
  }
  return {
    rectangle(
      bounds: CanvasBounds,
      zoom: number,
      budget: CanvasCandidateWorkBudget,
    ): CanvasSelectionQuery {
      const queryBounds = expandBounds(
        bounds,
        Math.max(strokePadding, STROKE_SELECTION_PADDING_PX / zoom),
      )
      return select(
        queryBounds,
        (candidate) => nodeIntersectsRectangle(candidate.node, bounds, zoom, budget),
        (candidate) => polylineIntersectsRectangle(candidate.path, bounds, budget),
        budget,
      )
    },
    polygon(
      polygon: ReadonlyArray<CanvasPoint>,
      budget: CanvasCandidateWorkBudget,
    ): CanvasSelectionQuery {
      if (polygon.length < 3) {
        return { selection: emptySelection(), exhausted: false, visited: 0 }
      }
      const queryBounds = expandBounds(pointsBounds(polygon), strokePadding)
      return select(
        queryBounds,
        (candidate) => nodeIntersectsPolygon(candidate.node, polygon, budget),
        (candidate) => polylineIntersectsPolygon(candidate.path, polygon, budget),
        budget,
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
    if (!budget.consume()) return false
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
    if (!budget.consume()) return false
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
