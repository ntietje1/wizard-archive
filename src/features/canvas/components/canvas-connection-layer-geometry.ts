import { CANVAS_HANDLE_POSITION } from '~/features/canvas/types/canvas-domain-types'
import type { CanvasHandlePosition } from '~/features/canvas/types/canvas-domain-types'
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
import { assertNever } from '~/shared/utils/utils'

type CanvasConnectionDraftEndpoint = {
  nodeId: string
  handleId: string | null
  position: CanvasHandlePosition
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
      default:
        return assertNever(edgeType)
    }
  }

  switch (edgeType) {
    case 'bezier':
      return buildFreeDragBezierPreviewGeometry(draft.source, draft.current)
    case 'straight': {
      const renderProps = {
        sourceX: draft.source.point.x,
        sourceY: draft.source.point.y,
        targetX: draft.current.x,
        targetY: draft.current.y,
        sourcePosition: draft.source.position,
        targetPosition: getOppositePosition(draft.source.position),
      }
      return buildStraightCanvasEdgeGeometryFromRenderProps(renderProps)
    }
    case 'step': {
      const renderProps = {
        sourceX: draft.source.point.x,
        sourceY: draft.source.point.y,
        targetX: draft.current.x,
        targetY: draft.current.y,
        sourcePosition: draft.source.position,
        targetPosition: getOppositePosition(draft.source.position),
      }
      return buildStepCanvasEdgeGeometryFromRenderProps(renderProps)
    }
    default:
      return assertNever(edgeType)
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

function getOppositePosition(position: CanvasHandlePosition): CanvasHandlePosition {
  switch (position) {
    case CANVAS_HANDLE_POSITION.Top:
      return CANVAS_HANDLE_POSITION.Bottom
    case CANVAS_HANDLE_POSITION.Right:
      return CANVAS_HANDLE_POSITION.Left
    case CANVAS_HANDLE_POSITION.Bottom:
      return CANVAS_HANDLE_POSITION.Top
    case CANVAS_HANDLE_POSITION.Left:
      return CANVAS_HANDLE_POSITION.Right
    default:
      return assertNever(position)
  }
}

function positionToVector(position: CanvasHandlePosition): Point2D {
  switch (position) {
    case CANVAS_HANDLE_POSITION.Top:
      return { x: 0, y: -1 }
    case CANVAS_HANDLE_POSITION.Right:
      return { x: 1, y: 0 }
    case CANVAS_HANDLE_POSITION.Bottom:
      return { x: 0, y: 1 }
    case CANVAS_HANDLE_POSITION.Left:
      return { x: -1, y: 0 }
    default:
      return assertNever(position)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
