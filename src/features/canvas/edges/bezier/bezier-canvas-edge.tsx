import { useNodes } from '@xyflow/react'
import {
  buildBezierCanvasEdgeGeometryFromEdge,
  buildBezierCanvasEdgeGeometryFromRenderProps,
} from './bezier-canvas-edge-geometry'
import { CanvasPathEdge } from '../shared/canvas-path-edge'
import type { CanvasEdgeRendererProps } from '../canvas-edge-module-types'

export function BezierCanvasEdge(props: CanvasEdgeRendererProps) {
  const nodes = useNodes()
  const nodesById = new Map(nodes.map((node) => [node.id, node] as const))
  const geometry =
    buildBezierCanvasEdgeGeometryFromEdge(
      {
        id: props.id,
        type: props.type,
        source: props.source,
        target: props.target,
        sourceHandle: props.sourceHandleId ?? null,
        targetHandle: props.targetHandleId ?? null,
      },
      nodesById,
    ) ?? buildBezierCanvasEdgeGeometryFromRenderProps(props)

  return <CanvasPathEdge props={props} geometry={geometry} />
}
