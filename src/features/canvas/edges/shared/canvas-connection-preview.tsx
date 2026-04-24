import { buildBezierCanvasEdgeGeometryFromEdge } from '../bezier/bezier-canvas-edge-geometry'
import {
  buildStepCanvasEdgeGeometryFromEdge,
  buildStepCanvasEdgeGeometryFromRenderProps,
} from '../step/step-canvas-edge-geometry'
import {
  buildStraightCanvasEdgeGeometryFromEdge,
  buildStraightCanvasEdgeGeometryFromRenderProps,
} from '../straight/straight-canvas-edge-geometry'
import { resolveCanvasEdgeEndpoint } from './canvas-edge-geometry'
import { assertNever } from '~/shared/utils/utils'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import type { CanvasEdgeRendererProps } from '../canvas-edge-types'
import { Position } from '@xyflow/react'
import type { ConnectionLineComponentProps, InternalNode, Node } from '@xyflow/react'
import type { CSSProperties } from 'react'
import type { Point2D } from '../../utils/canvas-awareness-types'
import { useShallow } from 'zustand/shallow'

const CONNECTION_PREVIEW_PATH_STYLE: CSSProperties = {
  fill: 'none',
  pointerEvents: 'none',
  strokeLinecap: 'square',
  strokeLinejoin: 'round',
}
const PREVIEW_BEZIER_SOURCE_CONTROL_MAX = 48
const PREVIEW_BEZIER_TARGET_PULL_MAX = 24

function unwrapInternalNode(internalNode: InternalNode<Node>): Node {
  return internalNode.internals.userNode
}

function offsetPoint(point: Point2D, position: Position, distance: number): Point2D {
  switch (position) {
    case Position.Top:
      return { x: point.x, y: point.y - distance }
    case Position.Right:
      return { x: point.x + distance, y: point.y }
    case Position.Bottom:
      return { x: point.x, y: point.y + distance }
    case Position.Left:
      return { x: point.x - distance, y: point.y }
  }
}

function getForwardDistance(sourcePosition: Position, dx: number, dy: number): number {
  switch (sourcePosition) {
    case Position.Top:
      return -dy
    case Position.Right:
      return dx
    case Position.Bottom:
      return dy
    case Position.Left:
      return -dx
  }
}

function buildPreviewBezierGeometry(
  sourcePosition: Position,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): { path: string } {
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const distance = Math.hypot(dx, dy)
  const sourceControlDistance = Math.min(
    PREVIEW_BEZIER_SOURCE_CONTROL_MAX,
    Math.min(Math.max(0, getForwardDistance(sourcePosition, dx, dy)), distance / 2),
  )
  const targetPullDistance = Math.min(PREVIEW_BEZIER_TARGET_PULL_MAX, distance / 4)
  const source = { x: sourceX, y: sourceY }
  const target = { x: targetX, y: targetY }
  const control1 = offsetPoint(source, sourcePosition, sourceControlDistance)
  const control2 =
    distance > 0
      ? {
          x: targetX - (dx / distance) * targetPullDistance,
          y: targetY - (dy / distance) * targetPullDistance,
        }
      : target

  return {
    path: `M ${source.x},${source.y} C ${control1.x},${control1.y} ${control2.x},${control2.y} ${target.x},${target.y}`,
  }
}

type CanvasConnectionPreviewGeometry =
  | ReturnType<typeof buildPreviewBezierGeometry>
  | NonNullable<ReturnType<typeof buildBezierCanvasEdgeGeometryFromEdge>>
  | ReturnType<typeof buildStraightCanvasEdgeGeometryFromRenderProps>

function buildConnectionPreviewGeometry(
  edgeType: 'bezier' | 'straight' | 'step',
  props: ConnectionLineComponentProps<Node>,
): CanvasConnectionPreviewGeometry | null {
  const sourceNode = unwrapInternalNode(props.fromNode)

  if (props.toNode) {
    const nodesById = new Map([
      [props.fromNode.id, sourceNode],
      [props.toNode.id, unwrapInternalNode(props.toNode)],
    ])
    const edge = {
      id: 'canvas-connection-preview',
      source: props.fromNode.id,
      target: props.toNode.id,
      sourceHandle: props.fromHandle.id ?? null,
      targetHandle: props.toHandle?.id ?? null,
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

  const sourceEndpoint = resolveCanvasEdgeEndpoint(
    sourceNode,
    props.fromHandle.id ?? null,
    props.fromPosition,
  )
  const source = sourceEndpoint?.point ?? { x: props.fromX, y: props.fromY }
  const sourcePosition = sourceEndpoint?.position ?? props.fromPosition

  if (edgeType === 'bezier') {
    return buildPreviewBezierGeometry(sourcePosition, source.x, source.y, props.toX, props.toY)
  }

  const renderProps: Pick<
    CanvasEdgeRendererProps,
    'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
  > = {
    sourceX: source.x,
    sourceY: source.y,
    targetX: props.toX,
    targetY: props.toY,
    sourcePosition,
    targetPosition: props.toPosition,
  }

  switch (edgeType) {
    case 'straight':
      return buildStraightCanvasEdgeGeometryFromRenderProps(renderProps)
    case 'step':
      return buildStepCanvasEdgeGeometryFromRenderProps(renderProps)
    default:
      return assertNever(edgeType)
  }
}

export function CanvasConnectionPreview(props: ConnectionLineComponentProps<Node>) {
  const { edgeType, strokeColor, strokeOpacity, strokeSize } = useCanvasToolStore(
    useShallow((state) => ({
      edgeType: state.edgeType,
      strokeColor: state.strokeColor,
      strokeOpacity: state.strokeOpacity,
      strokeSize: state.strokeSize,
    })),
  )
  const geometry = buildConnectionPreviewGeometry(edgeType, props)

  if (!geometry) {
    return null
  }

  return (
    <g data-testid="canvas-connection-preview" data-edge-type={edgeType}>
      <path
        d={geometry.path}
        style={{
          ...CONNECTION_PREVIEW_PATH_STYLE,
          stroke: strokeColor,
          strokeWidth: strokeSize,
          opacity: strokeOpacity / 100,
        }}
      />
    </g>
  )
}
