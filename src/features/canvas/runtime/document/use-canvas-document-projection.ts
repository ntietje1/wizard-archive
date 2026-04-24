import { useEffect, useLayoutEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { yMapToArray } from '../../utils/canvas-yjs-utils'
import { stripEphemeralCanvasNodeState } from '../../utils/canvas-node-persistence'
import { measureCanvasPerformance } from '../performance/canvas-performance-metrics'
import type { ResizingState } from '../../utils/canvas-awareness-types'
import type { CanvasRemoteDragAnimation } from '../interaction/use-canvas-remote-drag-animation'
import { sortCanvasElementsByZIndex } from './canvas-z-order'
import type { Edge, Node } from '@xyflow/react'
import type * as Y from 'yjs'

interface UseCanvasDocumentProjectionOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  localDraggingIdsRef: React.RefObject<Set<string>>
  remoteResizeDimensions: ResizingState
  remoteDragAnimation: CanvasRemoteDragAnimation
}

export function useCanvasDocumentProjection({
  nodesMap,
  edgesMap,
  localDraggingIdsRef,
  remoteResizeDimensions,
  remoteDragAnimation,
}: UseCanvasDocumentProjectionOptions) {
  const reactFlow = useReactFlow()
  const remoteResizeDimensionsRef = useRef(remoteResizeDimensions)
  const remoteDragAnimationRef = useRef(remoteDragAnimation)

  useLayoutEffect(() => {
    remoteResizeDimensionsRef.current = remoteResizeDimensions
    remoteDragAnimationRef.current = remoteDragAnimation
  }, [remoteDragAnimation, remoteResizeDimensions])

  useEffect(() => {
    reactFlow.setNodes(
      measureCanvasPerformance(
        'canvas.projection.nodes.initial',
        { nodeCount: nodesMap.size },
        () => sortCanvasElementsByZIndex(yMapToArray(nodesMap).map(stripEphemeralCanvasNodeState)),
      ),
    )

    const handler = (event: Y.YMapEvent<Node>) => {
      reactFlow.setNodes((current) =>
        measureCanvasPerformance(
          'canvas.projection.nodes.observe',
          { nodeCount: nodesMap.size, currentCount: current.length },
          () =>
            applyChangedCanvasNodes(current, event.keysChanged, {
              nodesMap,
              localDraggingIds: localDraggingIdsRef.current,
              remoteResizeDimensions: remoteResizeDimensionsRef.current,
              remoteDragAnimation: remoteDragAnimationRef.current,
            }),
        ),
      )
    }

    nodesMap.observe(handler)
    return () => nodesMap.unobserve(handler)
  }, [localDraggingIdsRef, nodesMap, reactFlow])

  useEffect(() => {
    reactFlow.setEdges(
      measureCanvasPerformance(
        'canvas.projection.edges.initial',
        { edgeCount: edgesMap.size },
        () => sortCanvasElementsByZIndex(yMapToArray(edgesMap)),
      ),
    )

    const handler = (event: Y.YMapEvent<Edge>) => {
      reactFlow.setEdges((current) =>
        measureCanvasPerformance(
          'canvas.projection.edges.observe',
          { edgeCount: edgesMap.size, currentCount: current.length },
          () => applyChangedCanvasEdges(current, event.keysChanged, edgesMap),
        ),
      )
    }

    edgesMap.observe(handler)
    return () => edgesMap.unobserve(handler)
  }, [edgesMap, reactFlow])

  useEffect(() => {
    if (Object.keys(remoteResizeDimensions).length === 0) return

    reactFlow.setNodes((current) =>
      measureCanvasPerformance(
        'canvas.projection.remote-resize',
        { nodeCount: current.length, resizeCount: Object.keys(remoteResizeDimensions).length },
        () =>
          current.map((node) => {
            const resizeDimensions = remoteResizeDimensions[node.id]
            if (!resizeDimensions) return node
            return {
              ...node,
              width: resizeDimensions.width,
              height: resizeDimensions.height,
              position: { x: resizeDimensions.x, y: resizeDimensions.y },
            }
          }),
      ),
    )
  }, [reactFlow, remoteResizeDimensions])
}

function applyChangedCanvasNodes(
  current: Array<Node>,
  changedIds: Set<string>,
  {
    nodesMap,
    localDraggingIds,
    remoteResizeDimensions,
    remoteDragAnimation,
  }: {
    nodesMap: Y.Map<Node>
    localDraggingIds: Set<string> | undefined
    remoteResizeDimensions: ResizingState
    remoteDragAnimation: CanvasRemoteDragAnimation
  },
) {
  if (changedIds.size === 0) {
    return current
  }

  const currentById = new Map(current.map((node) => [node.id, node]))
  const next: Array<Node> = []

  for (const node of current) {
    if (!changedIds.has(node.id)) {
      next.push(node)
      continue
    }

    const remoteNode = nodesMap.get(node.id)
    if (!remoteNode) {
      continue
    }

    next.push(
      mergeProjectedCanvasNode(node, stripEphemeralCanvasNodeState(remoteNode), {
        localDraggingIds,
        remoteResizeDimensions,
        remoteDragAnimation,
      }),
    )
  }

  for (const id of changedIds) {
    if (currentById.has(id)) {
      continue
    }

    const remoteNode = nodesMap.get(id)
    if (remoteNode) {
      next.push(stripEphemeralCanvasNodeState(remoteNode))
    }
  }

  return sortCanvasElementsByZIndex(next)
}

function mergeProjectedCanvasNode(
  local: Node,
  remote: Node,
  {
    localDraggingIds,
    remoteResizeDimensions,
    remoteDragAnimation,
  }: {
    localDraggingIds: Set<string> | undefined
    remoteResizeDimensions: ResizingState
    remoteDragAnimation: CanvasRemoteDragAnimation
  },
) {
  if (localDraggingIds?.has(remote.id)) {
    return { ...local, ...remote, position: local.position }
  }

  const resizeDimensions = remoteResizeDimensions[remote.id]
  if (resizeDimensions) {
    return {
      ...local,
      ...remote,
      width: resizeDimensions.width,
      height: resizeDimensions.height,
      position: { x: resizeDimensions.x, y: resizeDimensions.y },
    }
  }

  if (remoteDragAnimation.hasSpring(remote.id)) {
    remoteDragAnimation.setTarget(remote.id, remote.position)
    return { ...local, ...remote, position: local.position }
  }

  return { ...local, ...remote }
}

function applyChangedCanvasEdges(
  current: Array<Edge>,
  changedIds: Set<string>,
  edgesMap: Y.Map<Edge>,
) {
  if (changedIds.size === 0) {
    return current
  }

  const currentById = new Map(current.map((edge) => [edge.id, edge]))
  const next: Array<Edge> = []

  for (const edge of current) {
    if (!changedIds.has(edge.id)) {
      next.push(edge)
      continue
    }

    const remoteEdge = edgesMap.get(edge.id)
    if (remoteEdge) {
      next.push({ ...edge, ...remoteEdge })
    }
  }

  for (const id of changedIds) {
    if (currentById.has(id)) {
      continue
    }

    const remoteEdge = edgesMap.get(id)
    if (remoteEdge) {
      next.push(remoteEdge)
    }
  }

  return sortCanvasElementsByZIndex(next)
}
