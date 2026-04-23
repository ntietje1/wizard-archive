import { useNodes } from '@xyflow/react'
import {
  buildStraightCanvasEdgeGeometryFromEdge,
  buildStraightCanvasEdgeGeometryFromRenderProps,
} from './straight-canvas-edge-geometry'
import { CanvasPathEdge } from '../shared/canvas-path-edge'
import type { CanvasEdgeRendererProps } from '../canvas-edge-module-types'

export function StraightCanvasEdge(
  props: CanvasEdgeRendererProps<Record<string, unknown>, 'straight'>,
) {
  const nodes = useNodes()
  const nodesById = new Map(nodes.map((node) => [node.id, node] as const))
  const geometry =
    buildStraightCanvasEdgeGeometryFromEdge(
      {
        id: props.id,
        type: props.type,
        source: props.source,
        target: props.target,
        sourceHandle: props.sourceHandleId ?? null,
        targetHandle: props.targetHandleId ?? null,
      },
      nodesById,
    ) ?? buildStraightCanvasEdgeGeometryFromRenderProps(props)

  return <CanvasPathEdge props={props} geometry={geometry} />
}
