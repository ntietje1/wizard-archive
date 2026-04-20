import { bezierCanvasEdgeModule } from './bezier/bezier-canvas-edge-module'
import { boundsFromPoints, rectIntersectsBounds } from '../utils/canvas-geometry-utils'
import type {
  AnyCanvasEdgeModule,
  CanvasEdgeSelectionContext,
  CanvasEdgeType,
} from './canvas-edge-module-types'
import type { CanvasContextMenuContributor } from '../runtime/context-menu/canvas-context-menu-types'
import type { Point2D } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-geometry-utils'
import type { Edge, EdgeTypes, Node } from '@xyflow/react'

const canvasEdgeModules = [
  bezierCanvasEdgeModule,
] as const satisfies ReadonlyArray<AnyCanvasEdgeModule>

const canvasEdgeModuleMap: Partial<Record<CanvasEdgeType, AnyCanvasEdgeModule>> =
  Object.fromEntries(canvasEdgeModules.map((module) => [module.type, module] as const))

export const canvasEdgeTypes = Object.fromEntries(
  canvasEdgeModules.map((module) => [module.type, module.EdgeComponent] as const),
) as EdgeTypes

function isCanvasEdgeType(type: string): type is CanvasEdgeType {
  return type in canvasEdgeModuleMap
}

function createCanvasEdgeSelectionContext(
  nodes: Array<Node>,
  zoom: number,
): CanvasEdgeSelectionContext {
  return {
    nodesById: new Map(nodes.map((node) => [node.id, node] as const)),
    zoom,
  }
}

function getCanvasEdgeModule(type: CanvasEdgeType): AnyCanvasEdgeModule {
  const module = canvasEdgeModuleMap[type]
  if (!module) {
    throw new Error(`Missing canvas edge module for "${type}"`)
  }

  return module
}

function getCanvasEdgeModuleByType(type: string | undefined): AnyCanvasEdgeModule {
  if (!type) return bezierCanvasEdgeModule
  if (!isCanvasEdgeType(type)) return bezierCanvasEdgeModule
  return getCanvasEdgeModule(type)
}

export function getCanvasEdgeContextMenuContributors(type: string | undefined) {
  return (getCanvasEdgeModuleByType(type).contextMenu?.contributors ??
    []) as ReadonlyArray<CanvasContextMenuContributor>
}

function filterCanvasEdgeSelectionCandidates(
  edges: Array<Edge>,
  candidateBounds: Bounds | null,
  context: CanvasEdgeSelectionContext,
) {
  if (!candidateBounds) return edges

  return edges.filter((edge) => {
    const bounds = getCanvasEdgeModuleByType(edge.type).selection.getBounds(edge, context)
    return !bounds || rectIntersectsBounds(candidateBounds, bounds)
  })
}

export function findCanvasEdgeAtPoint(
  nodes: Array<Node>,
  edges: Array<Edge>,
  point: Point2D,
  context: Pick<CanvasEdgeSelectionContext, 'zoom'>,
): string | null {
  const selectionContext = createCanvasEdgeSelectionContext(nodes, context.zoom)

  for (let index = edges.length - 1; index >= 0; index -= 1) {
    const edge = edges[index]
    if (getCanvasEdgeModuleByType(edge.type).selection.point(edge, point, selectionContext)) {
      return edge.id
    }
  }

  return null
}

export function getCanvasEdgesMatchingRectangle(
  nodes: Array<Node>,
  edges: Array<Edge>,
  rect: Bounds,
  context: Pick<CanvasEdgeSelectionContext, 'zoom'>,
): Array<string> {
  const selectionContext = createCanvasEdgeSelectionContext(nodes, context.zoom)

  return filterCanvasEdgeSelectionCandidates(edges, rect, selectionContext)
    .filter((edge) =>
      getCanvasEdgeModuleByType(edge.type).selection.rectangle(edge, rect, selectionContext),
    )
    .map((edge) => edge.id)
}

export function getCanvasEdgesMatchingLasso(
  nodes: Array<Node>,
  edges: Array<Edge>,
  polygon: Array<Point2D>,
  context: Pick<CanvasEdgeSelectionContext, 'zoom'>,
): Array<string> {
  const selectionContext = createCanvasEdgeSelectionContext(nodes, context.zoom)
  const polygonBounds = boundsFromPoints(polygon)

  return filterCanvasEdgeSelectionCandidates(edges, polygonBounds, selectionContext)
    .filter((edge) =>
      getCanvasEdgeModuleByType(edge.type).selection.lasso(edge, polygon, selectionContext),
    )
    .map((edge) => edge.id)
}
