import { useNodes } from '@xyflow/react'
import {
  buildBezierCanvasEdgeGeometryFromEdge,
  buildBezierCanvasEdgeGeometryFromRenderProps,
} from './bezier-canvas-edge-geometry'
import { CanvasPathEdge } from '../shared/canvas-path-edge'
import { createCanvasNodesById } from '../shared/canvas-node-map'
import type { CanvasEdgeRendererProps } from '../canvas-edge-types'

export function BezierCanvasEdge(props: CanvasEdgeRendererProps) {
  const nodes = useNodes()
  const nodesById = createCanvasNodesById(nodes)
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
