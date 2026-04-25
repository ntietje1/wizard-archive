import {
  buildStepCanvasEdgeGeometryFromEdge,
  buildStepCanvasEdgeGeometryFromRenderProps,
} from './step-canvas-edge-geometry'
import { CanvasPathEdge } from '../shared/canvas-path-edge'
import {
  createCanvasEndpointNodesById,
  useCanvasEdgeEndpointNodes,
} from '../shared/use-canvas-edge-endpoint-nodes'
import type { CanvasEdgeRendererProps } from '../canvas-edge-types'

export function StepCanvasEdge(props: CanvasEdgeRendererProps<Record<string, unknown>, 'step'>) {
  const endpointNodes = useCanvasEdgeEndpointNodes(props)
  const nodesById = createCanvasEndpointNodesById(endpointNodes)
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
