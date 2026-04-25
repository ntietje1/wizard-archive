import { useCanvasEngineSelector } from '../../react/use-canvas-engine'
import {
  areCanvasEdgeEndpointNodesEqual,
  selectCanvasEdgeEndpointNodes,
} from '../../system/canvas-engine-selectors'
import type { CanvasEdgeRendererProps } from '../canvas-edge-types'
import type { CanvasEdgeEndpointNodes } from '../../system/canvas-engine-selectors'
import type { Node } from '@xyflow/react'

export function useCanvasEdgeEndpointNodes(
  props: Pick<CanvasEdgeRendererProps, 'source' | 'target'>,
) {
  return useCanvasEngineSelector(
    (snapshot) => selectCanvasEdgeEndpointNodes(snapshot, props.source, props.target),
    areCanvasEdgeEndpointNodesEqual,
  )
}

export function createCanvasEndpointNodesById(
  endpointNodes: CanvasEdgeEndpointNodes,
): ReadonlyMap<string, Node> {
  const nodesById = new Map<string, Node>()
  if (endpointNodes.source) {
    nodesById.set(endpointNodes.source.id, endpointNodes.source)
  }
  if (endpointNodes.target) {
    nodesById.set(endpointNodes.target.id, endpointNodes.target)
  }
  return nodesById
}
