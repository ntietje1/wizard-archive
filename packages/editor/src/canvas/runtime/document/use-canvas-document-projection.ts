import { useEffect, useLayoutEffect, useRef } from 'react'
import { measureCanvasPerformance } from '../performance/canvas-performance-metrics'
import type { ResizingState } from '../../utils/canvas-awareness-types'
import { sortCanvasElementsByZIndex } from './canvas-z-order'
import type { CanvasDocumentNodePatch } from '../../types/canvas-domain-types'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type * as Y from 'yjs'
import { normalizeCanvasDocumentEdge, normalizeCanvasDocumentNode } from '../../document-contract'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../../document-contract'
import { canvasDevLogger } from '../../internal/dev-logger'

interface UseCanvasDocumentProjectionOptions {
  canvasEngine: CanvasEngine
  nodesMap: Y.Map<CanvasDocumentNode>
  edgesMap: Y.Map<CanvasDocumentEdge>
  localDraggingIdsRef: React.RefObject<Set<string>>
  remoteResizeDimensions: ResizingState
}

export function useCanvasDocumentProjection({
  canvasEngine,
  nodesMap,
  edgesMap,
  localDraggingIdsRef,
  remoteResizeDimensions,
}: UseCanvasDocumentProjectionOptions) {
  const remoteResizeDimensionsRef = useRef(remoteResizeDimensions)
  const previousRemoteResizeIdsRef = useRef<Set<string>>(new Set())

  useLayoutEffect(() => {
    remoteResizeDimensionsRef.current = remoteResizeDimensions
  }, [remoteResizeDimensions])

  useEffect(() => {
    const initialNodes = measureCanvasPerformance(
      'canvas.projection.nodes.initial',
      { nodeCount: nodesMap.size },
      () =>
        sortCanvasElementsByZIndex(
          Array.from(nodesMap.entries()).flatMap(([nodeId, node]) => {
            const parsedNode = readCanvasDocumentNode(node, nodeId, true)
            return parsedNode ? [parsedNode] : []
          }),
        ),
    )
    canvasEngine.setDocumentSnapshot({ nodes: initialNodes })

    const handler = (event: Y.YMapEvent<CanvasDocumentNode>) => {
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
          })
          const nextNodes = projection
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
      () =>
        sortCanvasElementsByZIndex(
          Array.from(edgesMap.entries()).flatMap(([edgeId, edge]) => {
            const parsedEdge = readCanvasDocumentEdge(edge, edgeId, true)
            return parsedEdge ? [parsedEdge] : []
          }),
        ),
    )
    canvasEngine.setDocumentSnapshot({ edges: initialEdges })

    const handler = (event: Y.YMapEvent<CanvasDocumentEdge>) => {
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
    const currentResizeIds = new Set(Object.keys(remoteResizeDimensions))
    const previousResizeIds = previousRemoteResizeIdsRef.current
    previousRemoteResizeIdsRef.current = currentResizeIds

    const snapshot = canvasEngine.getSnapshot()
    const clearedResizeIds = new Set(
      [...previousResizeIds].filter((resizeId) => !currentResizeIds.has(resizeId)),
    )
    const currentNodes =
      clearedResizeIds.size > 0
        ? applyChangedCanvasNodes([...snapshot.nodes], clearedResizeIds, {
            nodesMap,
            localDraggingIds: localDraggingIdsRef.current,
            remoteResizeDimensions,
          })
        : snapshot.nodes

    if (clearedResizeIds.size > 0) {
      canvasEngine.setDocumentSnapshot({ nodes: currentNodes })
    }

    if (currentResizeIds.size === 0) {
      return
    }

    measureCanvasPerformance(
      'canvas.projection.remote-resize',
      {
        nodeCount: currentNodes.length,
        resizeCount: currentResizeIds.size,
      },
      () => updateCanvasEngineRemoteResize(canvasEngine, currentNodes, remoteResizeDimensions),
    )
  }, [canvasEngine, localDraggingIdsRef, nodesMap, remoteResizeDimensions])
}

function updateCanvasEngineRemoteResize(
  canvasEngine: CanvasEngine,
  current: ReadonlyArray<CanvasDocumentNode>,
  remoteResizeDimensions: ResizingState,
) {
  const updates = new Map<string, CanvasDocumentNodePatch>()
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
  current: Array<CanvasDocumentNode>,
  changedIds: Set<string>,
  {
    nodesMap,
    localDraggingIds,
    remoteResizeDimensions,
  }: {
    nodesMap: Y.Map<CanvasDocumentNode>
    localDraggingIds: Set<string> | undefined
    remoteResizeDimensions: ResizingState
  },
): Array<CanvasDocumentNode> {
  if (changedIds.size === 0) {
    return current
  }

  const currentIds = new Set(current.map((node) => node.id))
  const projection = projectExistingCanvasNodes(current, changedIds, {
    nodesMap,
    localDraggingIds,
    remoteResizeDimensions,
  })
  const next = projection.nodes
  let orderMayHaveChanged = projection.orderMayHaveChanged

  for (const id of changedIds) {
    const parsedRemoteNode = readAddedCanvasDocumentNode(id, currentIds, nodesMap)
    if (parsedRemoteNode) {
      next.push(parsedRemoteNode)
      orderMayHaveChanged = true
    }
  }

  return orderMayHaveChanged ? sortCanvasElementsByZIndex(next) : next
}

function projectExistingCanvasNodes(
  current: Array<CanvasDocumentNode>,
  changedIds: Set<string>,
  {
    nodesMap,
    localDraggingIds,
    remoteResizeDimensions,
  }: {
    nodesMap: Y.Map<CanvasDocumentNode>
    localDraggingIds: Set<string> | undefined
    remoteResizeDimensions: ResizingState
  },
) {
  const nodes: Array<CanvasDocumentNode> = []
  let orderMayHaveChanged = false

  for (const node of current) {
    if (!changedIds.has(node.id)) {
      nodes.push(node)
      continue
    }

    const projection = projectChangedCanvasNode(node, {
      nodesMap,
      localDraggingIds,
      remoteResizeDimensions,
    })
    if (projection.orderMayHaveChanged) {
      orderMayHaveChanged = true
    }
    if (projection.node) {
      nodes.push(projection.node)
    }
  }

  return { nodes, orderMayHaveChanged }
}

function readAddedCanvasDocumentNode(
  id: string,
  currentIds: Set<string>,
  nodesMap: Y.Map<CanvasDocumentNode>,
) {
  if (currentIds.has(id)) {
    return null
  }

  return nodesMap.has(id) ? readCanvasDocumentNode(nodesMap.get(id), id, true) : null
}

function projectChangedCanvasNode(
  node: CanvasDocumentNode,
  {
    nodesMap,
    localDraggingIds,
    remoteResizeDimensions,
  }: {
    nodesMap: Y.Map<CanvasDocumentNode>
    localDraggingIds: Set<string> | undefined
    remoteResizeDimensions: ResizingState
  },
) {
  if (!nodesMap.has(node.id)) {
    return { node: null, orderMayHaveChanged: true }
  }

  const parsedRemoteNode = readCanvasDocumentNode(nodesMap.get(node.id), node.id, true)
  if (!parsedRemoteNode) {
    return { node: null, orderMayHaveChanged: true }
  }

  const projectedNode = mergeProjectedCanvasNode(node, parsedRemoteNode, {
    localDraggingIds,
    remoteResizeDimensions,
  })
  return {
    node: projectedNode,
    orderMayHaveChanged: node.zIndex !== projectedNode.zIndex,
  }
}

function mergeProjectedCanvasNode(
  local: CanvasDocumentNode,
  remote: CanvasDocumentNode,
  {
    localDraggingIds,
    remoteResizeDimensions,
  }: {
    localDraggingIds: Set<string> | undefined
    remoteResizeDimensions: ResizingState
  },
) {
  if (localDraggingIds?.has(remote.id)) {
    return { ...remote, position: local.position }
  }

  const resizeDimensions = remoteResizeDimensions[remote.id]
  if (resizeDimensions) {
    return {
      ...remote,
      width: resizeDimensions.width,
      height: resizeDimensions.height,
      position: { x: resizeDimensions.x, y: resizeDimensions.y },
    }
  }

  return remote
}

function applyChangedCanvasEdges(
  current: Array<CanvasDocumentEdge>,
  changedIds: Set<string>,
  edgesMap: Y.Map<CanvasDocumentEdge>,
) {
  if (changedIds.size === 0) {
    return current
  }

  const currentIds = new Set(current.map((edge) => edge.id))
  const projection = projectExistingCanvasEdges(current, changedIds, edgesMap)
  const next = projection.edges
  let orderMayHaveChanged = projection.orderMayHaveChanged

  for (const id of changedIds) {
    const remoteEdge = readAddedCanvasDocumentEdge(id, currentIds, edgesMap)
    if (remoteEdge) {
      next.push(remoteEdge)
      orderMayHaveChanged = true
    }
  }

  return orderMayHaveChanged ? sortCanvasElementsByZIndex(next) : next
}

function projectExistingCanvasEdges(
  current: Array<CanvasDocumentEdge>,
  changedIds: Set<string>,
  edgesMap: Y.Map<CanvasDocumentEdge>,
) {
  const edges: Array<CanvasDocumentEdge> = []
  let orderMayHaveChanged = false

  for (const edge of current) {
    if (!changedIds.has(edge.id)) {
      edges.push(edge)
      continue
    }

    const projection = projectChangedCanvasEdge(edge, edgesMap)
    if (projection.orderMayHaveChanged) {
      orderMayHaveChanged = true
    }
    if (projection.edge) {
      edges.push(projection.edge)
    }
  }

  return { edges, orderMayHaveChanged }
}

function readAddedCanvasDocumentEdge(
  id: string,
  currentIds: Set<string>,
  edgesMap: Y.Map<CanvasDocumentEdge>,
) {
  if (currentIds.has(id)) {
    return null
  }

  return edgesMap.has(id) ? readCanvasDocumentEdge(edgesMap.get(id), id, true) : null
}

function projectChangedCanvasEdge(edge: CanvasDocumentEdge, edgesMap: Y.Map<CanvasDocumentEdge>) {
  if (!edgesMap.has(edge.id)) {
    return { edge: null, orderMayHaveChanged: true }
  }

  const remoteEdge = readCanvasDocumentEdge(edgesMap.get(edge.id), edge.id, true)
  if (!remoteEdge) {
    return { edge: null, orderMayHaveChanged: true }
  }

  const projectedEdge = { ...edge, ...remoteEdge }
  return {
    edge: projectedEdge,
    orderMayHaveChanged: edge.zIndex !== projectedEdge.zIndex,
  }
}

function readCanvasDocumentNode(
  node: unknown,
  nodeId: string,
  isPresent: boolean,
): CanvasDocumentNode | null {
  if (!isPresent) {
    return null
  }

  const parsedNode = normalizeCanvasDocumentNode(node)
  if (!parsedNode) {
    warnMalformedCanvasDocumentValue('node', nodeId, node)
    return null
  }

  if (parsedNode.id !== nodeId) {
    warnMismatchedCanvasDocumentId('node', nodeId, parsedNode.id)
    return null
  }

  return parsedNode
}

function readCanvasDocumentEdge(
  edge: unknown,
  edgeId: string,
  isPresent: boolean,
): CanvasDocumentEdge | null {
  if (!isPresent) {
    return null
  }

  const parsedEdge = normalizeCanvasDocumentEdge(edge)
  if (!parsedEdge) {
    warnMalformedCanvasDocumentValue('edge', edgeId, edge)
    return null
  }

  if (parsedEdge.id !== edgeId) {
    warnMismatchedCanvasDocumentId('edge', edgeId, parsedEdge.id)
    return null
  }

  return parsedEdge
}

function warnMalformedCanvasDocumentValue(kind: 'node' | 'edge', id: string, value: unknown) {
  canvasDevLogger.error(`Ignoring invalid canvas document ${kind} at projection boundary`, {
    id,
    valueType: typeof value,
  })
}

function warnMismatchedCanvasDocumentId(kind: 'node' | 'edge', id: string, valueId: string) {
  canvasDevLogger.error(
    `Ignoring canvas document ${kind} with mismatched map key at projection boundary`,
    {
      id,
      valueId,
    },
  )
}
