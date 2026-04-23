import { Position } from '@xyflow/react'
import { getCanvasNodeBounds } from '../../nodes/shared/canvas-node-bounds'
import { boundsFromPoints, rectIntersectsBounds } from '../../utils/canvas-geometry-utils'
import {
  buildPolylinePath,
  compactPolylinePoints,
  getCanvasEdgeEndpoints,
  getCanvasEdgePointThreshold,
  getPolylineMidpoint,
  pointNearPolyline,
  polylineIntersectsPolygon,
  polylineIntersectsRect,
} from '../shared/canvas-edge-geometry'
import type { PolylineCanvasEdgeGeometry } from '../shared/canvas-edge-geometry'
import type { Point2D } from '../../utils/canvas-awareness-types'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type { Edge, EdgeProps, Node } from '@xyflow/react'

const STEP_EDGE_STUB_LENGTH = 48
type StepSplitCoordinates = {
  splitX?: number
  splitY?: number
  relaxSplitX?: boolean
  relaxSplitY?: boolean
}

function isHorizontalPosition(position: Position): boolean {
  return position === Position.Left || position === Position.Right
}

function getPositionCoordinate(position: Position, point: Pick<Point2D, 'x' | 'y'>): number {
  return isHorizontalPosition(position) ? point.x : point.y
}

function getPositionDirection(position: Position): Point2D {
  switch (position) {
    case Position.Left:
      return { x: -1, y: 0 }
    case Position.Right:
      return { x: 1, y: 0 }
    case Position.Top:
      return { x: 0, y: -1 }
    case Position.Bottom:
      return { x: 0, y: 1 }
    default:
      return { x: 0, y: 0 }
  }
}

function buildStepStubPoint(point: Point2D, position: Position): Point2D {
  const direction = getPositionDirection(position)

  return {
    x: point.x + direction.x * STEP_EDGE_STUB_LENGTH,
    y: point.y + direction.y * STEP_EDGE_STUB_LENGTH,
  }
}

function respectsPositionDirection(
  position: Position,
  startCoordinate: number,
  nextCoordinate: number,
): boolean {
  const direction = isHorizontalPosition(position)
    ? getPositionDirection(position).x
    : getPositionDirection(position).y

  return (nextCoordinate - startCoordinate) * direction >= 0
}

function areHorizontalHandlesFacing(
  sourcePosition: Position,
  targetPosition: Position,
  sourceStubX: number,
  targetStubX: number,
): boolean {
  if (sourcePosition === Position.Right && targetPosition === Position.Left) {
    return sourceStubX <= targetStubX
  }

  if (sourcePosition === Position.Left && targetPosition === Position.Right) {
    return sourceStubX >= targetStubX
  }

  return false
}

function areVerticalHandlesFacing(
  sourcePosition: Position,
  targetPosition: Position,
  sourceStubY: number,
  targetStubY: number,
): boolean {
  if (sourcePosition === Position.Bottom && targetPosition === Position.Top) {
    return sourceStubY <= targetStubY
  }

  if (sourcePosition === Position.Top && targetPosition === Position.Bottom) {
    return sourceStubY >= targetStubY
  }

  return false
}

function getClosestHorizontalEdgeMidpoint(sourceNode: Node, targetNode: Node): number | null {
  const sourceBounds = getCanvasNodeBounds(sourceNode)
  const targetBounds = getCanvasNodeBounds(targetNode)
  if (!sourceBounds || !targetBounds) return null

  const sourceCenterX = sourceBounds.x + sourceBounds.width / 2
  const targetCenterX = targetBounds.x + targetBounds.width / 2

  if (sourceCenterX <= targetCenterX) {
    return (sourceBounds.x + sourceBounds.width + targetBounds.x) / 2
  }

  return (targetBounds.x + targetBounds.width + sourceBounds.x) / 2
}

function getClosestVerticalEdgeMidpoint(sourceNode: Node, targetNode: Node): number | null {
  const sourceBounds = getCanvasNodeBounds(sourceNode)
  const targetBounds = getCanvasNodeBounds(targetNode)
  if (!sourceBounds || !targetBounds) return null

  const sourceCenterY = sourceBounds.y + sourceBounds.height / 2
  const targetCenterY = targetBounds.y + targetBounds.height / 2

  if (sourceCenterY <= targetCenterY) {
    return (sourceBounds.y + sourceBounds.height + targetBounds.y) / 2
  }

  return (targetBounds.y + targetBounds.height + sourceBounds.y) / 2
}

function coordinateWithinBounds(
  coordinate: number | undefined,
  start: number,
  size: number,
): boolean {
  if (coordinate === undefined) return false

  return coordinate >= start && coordinate <= start + size
}

function buildRelaxedHorizontalStepPoints(
  props: Pick<
    EdgeProps,
    'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
  >,
): Array<Point2D> {
  const start = { x: props.sourceX, y: props.sourceY }
  const end = { x: props.targetX, y: props.targetY }

  if (
    (props.sourcePosition === Position.Right && props.targetPosition === Position.Left) ||
    (props.sourcePosition === Position.Left && props.targetPosition === Position.Right)
  ) {
    const middleX = (props.sourceX + props.targetX) / 2

    return compactPolylinePoints([
      start,
      { x: middleX, y: props.sourceY },
      { x: middleX, y: props.targetY },
      end,
    ])
  }

  const commonX =
    props.sourcePosition === Position.Right || props.targetPosition === Position.Right
      ? Math.max(props.sourceX, props.targetX)
      : Math.min(props.sourceX, props.targetX)

  return compactPolylinePoints([
    start,
    { x: commonX, y: props.sourceY },
    { x: commonX, y: props.targetY },
    end,
  ])
}

function buildRelaxedVerticalStepPoints(
  props: Pick<
    EdgeProps,
    'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
  >,
): Array<Point2D> {
  const start = { x: props.sourceX, y: props.sourceY }
  const end = { x: props.targetX, y: props.targetY }

  if (
    (props.sourcePosition === Position.Bottom && props.targetPosition === Position.Top) ||
    (props.sourcePosition === Position.Top && props.targetPosition === Position.Bottom)
  ) {
    const middleY = (props.sourceY + props.targetY) / 2

    return compactPolylinePoints([
      start,
      { x: props.sourceX, y: middleY },
      { x: props.targetX, y: middleY },
      end,
    ])
  }

  const commonY =
    props.sourcePosition === Position.Bottom || props.targetPosition === Position.Bottom
      ? Math.max(props.sourceY, props.targetY)
      : Math.min(props.sourceY, props.targetY)

  return compactPolylinePoints([
    start,
    { x: props.sourceX, y: commonY },
    { x: props.targetX, y: commonY },
    end,
  ])
}

function buildStepPoints(
  props: Pick<
    EdgeProps,
    'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
  >,
  splitCoordinates: StepSplitCoordinates = {},
): Array<Point2D> {
  const start = { x: props.sourceX, y: props.sourceY }
  const end = { x: props.targetX, y: props.targetY }
  const sourceHorizontal = isHorizontalPosition(props.sourcePosition)
  const targetHorizontal = isHorizontalPosition(props.targetPosition)
  const sourceStub = buildStepStubPoint(start, props.sourcePosition)
  const targetStub = buildStepStubPoint(end, props.targetPosition)

  if (sourceHorizontal && targetHorizontal) {
    if (
      areHorizontalHandlesFacing(
        props.sourcePosition,
        props.targetPosition,
        sourceStub.x,
        targetStub.x,
      )
    ) {
      const middleX = (sourceStub.x + targetStub.x) / 2

      return compactPolylinePoints([
        start,
        sourceStub,
        { x: middleX, y: sourceStub.y },
        { x: middleX, y: targetStub.y },
        targetStub,
        end,
      ])
    }

    if (splitCoordinates.relaxSplitY) {
      return buildRelaxedHorizontalStepPoints(props)
    }

    const middleY = splitCoordinates.splitY ?? (props.sourceY + props.targetY) / 2
    return compactPolylinePoints([
      start,
      sourceStub,
      { x: sourceStub.x, y: middleY },
      { x: targetStub.x, y: middleY },
      targetStub,
      end,
    ])
  }

  if (!sourceHorizontal && !targetHorizontal) {
    if (
      areVerticalHandlesFacing(
        props.sourcePosition,
        props.targetPosition,
        sourceStub.y,
        targetStub.y,
      )
    ) {
      const middleY = (sourceStub.y + targetStub.y) / 2

      return compactPolylinePoints([
        start,
        sourceStub,
        { x: sourceStub.x, y: middleY },
        { x: targetStub.x, y: middleY },
        targetStub,
        end,
      ])
    }

    if (splitCoordinates.relaxSplitX) {
      return buildRelaxedVerticalStepPoints(props)
    }

    const middleX = splitCoordinates.splitX ?? (props.sourceX + props.targetX) / 2
    return compactPolylinePoints([
      start,
      sourceStub,
      { x: middleX, y: sourceStub.y },
      { x: middleX, y: targetStub.y },
      targetStub,
      end,
    ])
  }

  if (sourceHorizontal) {
    const middleY = splitCoordinates.splitY ?? (props.sourceY + props.targetY) / 2

    if (
      !respectsPositionDirection(
        props.targetPosition,
        getPositionCoordinate(props.targetPosition, { x: props.targetX, y: props.targetY }),
        getPositionCoordinate(props.targetPosition, targetStub),
      ) ||
      !respectsPositionDirection(
        props.sourcePosition,
        getPositionCoordinate(props.sourcePosition, { x: props.sourceX, y: props.sourceY }),
        getPositionCoordinate(props.sourcePosition, sourceStub),
      )
    ) {
      return compactPolylinePoints([
        start,
        sourceStub,
        { x: sourceStub.x, y: middleY },
        { x: targetStub.x, y: middleY },
        targetStub,
        end,
      ])
    }

    return compactPolylinePoints([
      start,
      sourceStub,
      { x: sourceStub.x, y: targetStub.y },
      targetStub,
      end,
    ])
  }

  const middleX = splitCoordinates.splitX ?? (props.sourceX + props.targetX) / 2

  if (
    !respectsPositionDirection(
      props.targetPosition,
      getPositionCoordinate(props.targetPosition, { x: props.targetX, y: props.targetY }),
      getPositionCoordinate(props.targetPosition, targetStub),
    ) ||
    !respectsPositionDirection(
      props.sourcePosition,
      getPositionCoordinate(props.sourcePosition, { x: props.sourceX, y: props.sourceY }),
      getPositionCoordinate(props.sourcePosition, sourceStub),
    )
  ) {
    return compactPolylinePoints([
      start,
      sourceStub,
      { x: middleX, y: sourceStub.y },
      { x: middleX, y: targetStub.y },
      targetStub,
      end,
    ])
  }

  return compactPolylinePoints([
    start,
    sourceStub,
    { x: targetStub.x, y: sourceStub.y },
    targetStub,
    end,
  ])
}

export function buildStepCanvasEdgeGeometryFromRenderProps(
  props: Pick<
    EdgeProps,
    'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
  >,
  splitCoordinates: StepSplitCoordinates = {},
): PolylineCanvasEdgeGeometry {
  const points = buildStepPoints(props, splitCoordinates)
  const midpoint = getPolylineMidpoint(points)

  return {
    path: buildPolylinePath(points),
    labelX: midpoint.x,
    labelY: midpoint.y,
    points,
  }
}

export function buildStepCanvasEdgeGeometryFromEdge(
  edge: Edge,
  nodesById: ReadonlyMap<string, Node>,
): PolylineCanvasEdgeGeometry | null {
  const sourceNode = nodesById.get(edge.source)
  const targetNode = nodesById.get(edge.target)
  const endpoints = getCanvasEdgeEndpoints(edge, nodesById)
  if (!endpoints || !sourceNode || !targetNode) return null

  const sourceBounds = getCanvasNodeBounds(sourceNode)
  const targetBounds = getCanvasNodeBounds(targetNode)
  const splitX = getClosestHorizontalEdgeMidpoint(sourceNode, targetNode) ?? undefined
  const splitY = getClosestVerticalEdgeMidpoint(sourceNode, targetNode) ?? undefined
  const relaxSplitX =
    !!sourceBounds &&
    !!targetBounds &&
    (coordinateWithinBounds(splitX, sourceBounds.x, sourceBounds.width) ||
      coordinateWithinBounds(splitX, targetBounds.x, targetBounds.width))
  const relaxSplitY =
    !!sourceBounds &&
    !!targetBounds &&
    (coordinateWithinBounds(splitY, sourceBounds.y, sourceBounds.height) ||
      coordinateWithinBounds(splitY, targetBounds.y, targetBounds.height))

  return buildStepCanvasEdgeGeometryFromRenderProps(endpoints, {
    splitX,
    splitY,
    relaxSplitX,
    relaxSplitY,
  })
}

export function getStepCanvasEdgeBounds(
  edge: Edge,
  nodesById: ReadonlyMap<string, Node>,
): Bounds | null {
  const geometry = buildStepCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return null

  return boundsFromPoints(geometry.points)
}

export function stepCanvasEdgeContainsPoint(
  edge: Edge,
  point: Point2D,
  nodesById: ReadonlyMap<string, Node>,
  zoom: number,
): boolean {
  const geometry = buildStepCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return false

  const bounds = boundsFromPoints(geometry.points)
  const threshold = getCanvasEdgePointThreshold(zoom)
  if (
    bounds &&
    !rectIntersectsBounds(bounds, {
      x: point.x - threshold,
      y: point.y - threshold,
      width: threshold * 2,
      height: threshold * 2,
    })
  ) {
    return false
  }

  return pointNearPolyline(point, geometry.points, threshold)
}

export function stepCanvasEdgeIntersectsRectangle(
  edge: Edge,
  rect: Bounds,
  nodesById: ReadonlyMap<string, Node>,
): boolean {
  const geometry = buildStepCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return false

  const bounds = boundsFromPoints(geometry.points)
  if (bounds && !rectIntersectsBounds(bounds, rect)) {
    return false
  }

  return polylineIntersectsRect(geometry.points, rect)
}

export function stepCanvasEdgeIntersectsPolygon(
  edge: Edge,
  polygon: ReadonlyArray<Point2D>,
  nodesById: ReadonlyMap<string, Node>,
): boolean {
  const geometry = buildStepCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return false

  const geometryBounds = boundsFromPoints(geometry.points)
  const polygonBounds = boundsFromPoints(polygon)
  if (geometryBounds && polygonBounds && !rectIntersectsBounds(geometryBounds, polygonBounds)) {
    return false
  }

  return polylineIntersectsPolygon(geometry.points, polygon)
}
