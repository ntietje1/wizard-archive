import {
  buildStraightCanvasEdgeGeometryFromEdge,
  buildStraightCanvasEdgeGeometryFromRenderProps,
} from './straight-canvas-edge-geometry'
import { CanvasPathEdge } from '../shared/canvas-path-edge'
import {
  createCanvasEndpointNodesById,
  useCanvasEdgeEndpointNodes,
} from '../shared/use-canvas-edge-endpoint-nodes'
import type { CanvasEdgeRendererProps } from '../canvas-edge-types'

export function StraightCanvasEdge(props: CanvasEdgeRendererProps<'straight'>) {
  const endpointNodes = useCanvasEdgeEndpointNodes(props)
  const nodesById = createCanvasEndpointNodesById(endpointNodes)
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
