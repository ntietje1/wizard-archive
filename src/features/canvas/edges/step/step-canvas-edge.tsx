import { useNodes } from '@xyflow/react'
import {
  buildStepCanvasEdgeGeometryFromEdge,
  buildStepCanvasEdgeGeometryFromRenderProps,
} from './step-canvas-edge-geometry'
import { CanvasPathEdge } from '../shared/canvas-path-edge'
import { createCanvasNodesById } from '../shared/canvas-node-map'
import type { CanvasEdgeRendererProps } from '../canvas-edge-types'

export function StepCanvasEdge(props: CanvasEdgeRendererProps<Record<string, unknown>, 'step'>) {
  const nodes = useNodes()
  const nodesById = createCanvasNodesById(nodes)
  const geometry =
    buildStepCanvasEdgeGeometryFromEdge(
      {
        id: props.id,
        type: props.type,
        source: props.source,
        target: props.target,
        sourceHandle: props.sourceHandleId ?? null,
        targetHandle: props.targetHandleId ?? null,
      },
      nodesById,
    ) ?? buildStepCanvasEdgeGeometryFromRenderProps(props)

  return <CanvasPathEdge props={props} geometry={geometry} />
}
