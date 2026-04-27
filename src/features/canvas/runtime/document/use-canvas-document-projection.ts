import { useEffect, useLayoutEffect, useRef } from 'react'
import { yMapToArray } from '../../utils/canvas-yjs-utils'
import { stripEphemeralCanvasNodeState } from '../../utils/canvas-node-persistence'
import { measureCanvasPerformance } from '../performance/canvas-performance-metrics'
import type { ResizingState } from '../../utils/canvas-awareness-types'
import type { CanvasRemoteDragAnimation } from '../interaction/use-canvas-remote-drag-animation'
import { sortCanvasElementsByZIndex } from './canvas-z-order'
import type {
  CanvasEdge as Edge,
  CanvasNode as Node,
} from '~/features/canvas/types/canvas-domain-types'
import type { CanvasEngine } from '../../system/canvas-engine'
import type * as Y from 'yjs'

interface UseCanvasDocumentProjectionOptions {
  canvasEngine: CanvasEngine
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  localDraggingIdsRef: React.RefObject<Set<string>>
  remoteResizeDimensions: ResizingState
  remoteDragAnimation: CanvasRemoteDragAnimation
}

export function useCanvasDocumentProjection({
  canvasEngine,
  nodesMap,
  edgesMap,
  localDraggingIdsRef,
  remoteResizeDimensions,
  remoteDragAnimation,
}: UseCanvasDocumentProjectionOptions) {
  const remoteResizeDimensionsRef = useRef(remoteResizeDimensions)
  const remoteDragAnimationRef = useRef(remoteDragAnimation)

  useLayoutEffect(() => {
    remoteResizeDimensionsRef.current = remoteResizeDimensions
    remoteDragAnimationRef.current = remoteDragAnimation
  }, [remoteDragAnimation, remoteResizeDimensions])

  useEffect(() => {
    const initialNodes = measureCanvasPerformance(
      'canvas.projection.nodes.initial',
      { nodeCount: nodesMap.size },
      () => sortCanvasElementsByZIndex(yMapToArray(nodesMap).map(stripEphemeralCanvasNodeState)),
    )
    canvasEngine.setDocumentSnapshot({ nodes: initialNodes })

    const handler = (event: Y.YMapEvent<Node>) => {
      measureCanvasPerformance(
        'canvas.projection.nodes.observe',
        {
          changedCount: event.keysChanged.size,
          currentCount: canvasEngine.getSnapshot().nodes.length,
          nodeCount: nodesMap.size,
        },
        () => {
          const snapshot = canvasEngine.getSnapshot()
          const projection = applyChangedCanvasNodes([...snapshot.nodes], event.keysChanged, {
            nodesMap,
            localDraggingIds: localDraggingIdsRef.current,
            remoteResizeDimensions: remoteResizeDimensionsRef.current,
            remoteDragAnimation: remoteDragAnimationRef.current,
          })
          for (const target of projection.remoteDragTargets) {
            remoteDragAnimationRef.current.setTarget(target.id, target.position)
          }
          const nextNodes = projection.nodes
          canvasEngine.setDocumentSnapshot({ nodes: nextNodes })
          return nextNodes
        },
      )
    }

    nodesMap.observe(handler)
    return () => nodesMap.unobserve(handler)
  }, [canvasEngine, localDraggingIdsRef, nodesMap])

  useEffect(() => {
    const initialEdges = measureCanvasPerformance(
      'canvas.projection.edges.initial',
      { edgeCount: edgesMap.size },
      () => sortCanvasElementsByZIndex(yMapToArray(edgesMap)),
    )
    canvasEngine.setDocumentSnapshot({ edges: initialEdges })

    const handler = (event: Y.YMapEvent<Edge>) => {
      measureCanvasPerformance(
        'canvas.projection.edges.observe',
        {
          changedCount: event.keysChanged.size,
          currentCount: canvasEngine.getSnapshot().edges.length,
          edgeCount: edgesMap.size,
        },
        () => {
          const nextEdges = applyChangedCanvasEdges(
            [...canvasEngine.getSnapshot().edges],
            event.keysChanged,
            edgesMap,
          )
          canvasEngine.setDocumentSnapshot({ edges: nextEdges })
          return nextEdges
        },
      )
    }

    edgesMap.observe(handler)
    return () => edgesMap.unobserve(handler)
  }, [canvasEngine, edgesMap])

  useEffect(() => {
    if (Object.keys(remoteResizeDimensions).length === 0) return

    const snapshot = canvasEngine.getSnapshot()
    measureCanvasPerformance(
      'canvas.projection.remote-resize',
      {
        nodeCount: snapshot.nodes.length,
        resizeCount: Object.keys(remoteResizeDimensions).length,
      },
      () => updateCanvasEngineRemoteResize(canvasEngine, snapshot.nodes, remoteResizeDimensions),
    )
  }, [canvasEngine, remoteResizeDimensions])
}

function updateCanvasEngineRemoteResize(
  canvasEngine: CanvasEngine,
  current: ReadonlyArray<Node>,
  remoteResizeDimensions: ResizingState,
) {
  const updates = new Map<string, Partial<Node>>()
  for (const node of current) {
    const resizeDimensions = remoteResizeDimensions[node.id]
    if (!resizeDimensions) {
      continue
    }

    updates.set(node.id, {
      width: resizeDimensions.width,
      height: resizeDimensions.height,
      position: { x: resizeDimensions.x, y: resizeDimensions.y },
    })
  }
  canvasEngine.patchNodes(updates)
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
): { nodes: Array<Node>; remoteDragTargets: Array<{ id: string; position: Node['position'] }> } {
  if (changedIds.size === 0) {
    return { nodes: current, remoteDragTargets: [] }
  }

  const currentById = new Map(current.map((node) => [node.id, node]))
  const next: Array<Node> = []
  const remoteDragTargets: Array<{ id: string; position: Node['position'] }> = []
  let orderMayHaveChanged = false

  for (const node of current) {
    if (!changedIds.has(node.id)) {
      next.push(node)
      continue
    }

    const remoteNode = nodesMap.get(node.id)
    if (!remoteNode) {
      orderMayHaveChanged = true
      continue
    }

    const projectedNode = mergeProjectedCanvasNode(
      node,
      stripEphemeralCanvasNodeState(remoteNode),
      {
        localDraggingIds,
        remoteResizeDimensions,
        remoteDragAnimation,
      },
    )
    if (projectedNode.remoteDragTarget) {
      remoteDragTargets.push(projectedNode.remoteDragTarget)
    }
    if (node.zIndex !== projectedNode.node.zIndex) {
      orderMayHaveChanged = true
    }
    next.push(projectedNode.node)
  }

  for (const id of changedIds) {
    if (currentById.has(id)) {
      continue
    }

    const remoteNode = nodesMap.get(id)
    if (remoteNode) {
      next.push(stripEphemeralCanvasNodeState(remoteNode))
      orderMayHaveChanged = true
    }
  }

  return {
    nodes: orderMayHaveChanged ? sortCanvasElementsByZIndex(next) : next,
    remoteDragTargets,
  }
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
    return { node: { ...local, ...remote, position: local.position }, remoteDragTarget: null }
  }

  const resizeDimensions = remoteResizeDimensions[remote.id]
  if (resizeDimensions) {
    return {
      node: {
        ...local,
        ...remote,
        width: resizeDimensions.width,
        height: resizeDimensions.height,
        position: { x: resizeDimensions.x, y: resizeDimensions.y },
      },
      remoteDragTarget: null,
    }
  }

  if (remoteDragAnimation.hasSpring(remote.id)) {
    return {
      node: { ...local, ...remote, position: local.position },
      remoteDragTarget: { id: remote.id, position: remote.position },
    }
  }

  return { node: { ...local, ...remote }, remoteDragTarget: null }
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
  let orderMayHaveChanged = false

  for (const edge of current) {
    if (!changedIds.has(edge.id)) {
      next.push(edge)
      continue
    }

    const remoteEdge = edgesMap.get(edge.id)
    if (remoteEdge) {
      const projectedEdge = { ...edge, ...remoteEdge }
      if (edge.zIndex !== projectedEdge.zIndex) {
        orderMayHaveChanged = true
      }
      next.push(projectedEdge)
    } else {
      orderMayHaveChanged = true
    }
  }

  for (const id of changedIds) {
    if (currentById.has(id)) {
      continue
    }

    const remoteEdge = edgesMap.get(id)
    if (remoteEdge) {
      next.push(remoteEdge)
      orderMayHaveChanged = true
    }
  }

  return orderMayHaveChanged ? sortCanvasElementsByZIndex(next) : next
}
