import { Position } from '@xyflow/react'
import { buildBezierCanvasEdgeGeometryFromEdge } from '../edges/bezier/bezier-canvas-edge-geometry'
import type { CanvasEdgeType } from '../edges/canvas-edge-types'
import {
  buildStepCanvasEdgeGeometryFromEdge,
  buildStepCanvasEdgeGeometryFromRenderProps,
} from '../edges/step/step-canvas-edge-geometry'
import {
  buildStraightCanvasEdgeGeometryFromEdge,
  buildStraightCanvasEdgeGeometryFromRenderProps,
} from '../edges/straight/straight-canvas-edge-geometry'
import type { CanvasEdge, CanvasNode } from '../types/canvas-domain-types'
import type { Point2D } from '../utils/canvas-awareness-types'

type CanvasConnectionDraftEndpoint = {
  nodeId: string
  handleId: string | null
  position: Position
  point: Point2D
}

export type CanvasConnectionDraft = {
  source: CanvasConnectionDraftEndpoint
  current: Point2D
  snapTarget: CanvasConnectionDraftEndpoint | null
}

type CanvasConnectionPreviewGeometry = {
  path: string
}

const FREE_DRAG_BEZIER_MIN_CONTROL_DISTANCE = 24
const FREE_DRAG_BEZIER_MAX_CONTROL_DISTANCE = 180

export function buildConnectionDraftGeometry(
  edgeType: CanvasEdgeType,
  draft: CanvasConnectionDraft,
  nodesById: ReadonlyMap<string, CanvasNode>,
): CanvasConnectionPreviewGeometry | null {
  if (draft.snapTarget) {
    const edge: CanvasEdge = {
      id: 'canvas-connection-preview',
      source: draft.source.nodeId,
      target: draft.snapTarget.nodeId,
      sourceHandle: draft.source.handleId,
      targetHandle: draft.snapTarget.handleId,
      type: edgeType,
    }

    switch (edgeType) {
      case 'bezier':
        return buildBezierCanvasEdgeGeometryFromEdge(edge, nodesById)
      case 'straight':
        return buildStraightCanvasEdgeGeometryFromEdge(edge, nodesById)
      case 'step':
        return buildStepCanvasEdgeGeometryFromEdge(edge, nodesById)
    }
  }

  const renderProps = {
    sourceX: draft.source.point.x,
    sourceY: draft.source.point.y,
    targetX: draft.current.x,
    targetY: draft.current.y,
    sourcePosition: draft.source.position,
    targetPosition: getOppositePosition(draft.source.position),
  }

  switch (edgeType) {
    case 'bezier':
      return buildFreeDragBezierPreviewGeometry(draft.source, draft.current)
    case 'straight':
      return buildStraightCanvasEdgeGeometryFromRenderProps(renderProps)
    case 'step':
      return buildStepCanvasEdgeGeometryFromRenderProps(renderProps)
  }
}

function buildFreeDragBezierPreviewGeometry(
  source: CanvasConnectionDraftEndpoint,
  current: Point2D,
): CanvasConnectionPreviewGeometry {
  const dx = current.x - source.point.x
  const dy = current.y - source.point.y
  const distance = Math.hypot(dx, dy)
  const sourceDirection = positionToVector(source.position)
  const dragDirection = distance > 0 ? { x: dx / distance, y: dy / distance } : sourceDirection
  const controlDistance = clamp(
    distance * 0.5,
    FREE_DRAG_BEZIER_MIN_CONTROL_DISTANCE,
    FREE_DRAG_BEZIER_MAX_CONTROL_DISTANCE,
  )
  const targetControlDistance = Math.min(controlDistance, distance * 0.35)
  const control1 = {
    x: source.point.x + sourceDirection.x * controlDistance,
    y: source.point.y + sourceDirection.y * controlDistance,
  }
  const control2 = {
    x: current.x - dragDirection.x * targetControlDistance,
    y: current.y - dragDirection.y * targetControlDistance,
  }

  return {
    path: `M ${source.point.x},${source.point.y} C ${control1.x},${control1.y} ${control2.x},${control2.y} ${current.x},${current.y}`,
  }
}

function getOppositePosition(position: Position): Position {
  switch (position) {
    case Position.Top:
      return Position.Bottom
    case Position.Right:
      return Position.Left
    case Position.Bottom:
      return Position.Top
    case Position.Left:
      return Position.Right
  }
}

function positionToVector(position: Position): Point2D {
  switch (position) {
    case Position.Top:
      return { x: 0, y: -1 }
    case Position.Right:
      return { x: 1, y: 0 }
    case Position.Bottom:
      return { x: 0, y: 1 }
    case Position.Left:
      return { x: -1, y: 0 }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
