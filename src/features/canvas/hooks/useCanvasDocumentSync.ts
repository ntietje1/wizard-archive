import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { isStrokeNode, resizeStrokeNode } from '../utils/canvas-stroke-utils'
import type { CanvasDocumentActions } from '../tools/canvas-tool-types'
import type { ResizingState } from '../utils/canvas-awareness-types'
import type {
  Connection,
  Edge,
  Node,
  OnConnect,
  OnEdgesDelete,
  OnNodeDrag,
  OnNodesDelete,
} from '@xyflow/react'
import type * as Y from 'yjs'
import type { SpringState } from '~/shared/hooks/useSpringPosition'
import { SPRING_DEFAULTS, stepSpring } from '~/shared/hooks/useSpringPosition'

function yMapToArray<T>(map: Y.Map<T>): Array<T> {
  const items: Array<T> = []
  map.forEach((value) => items.push(value))
  return items
}

interface UseCanvasDocumentSyncOptions {
  nodesMap: Y.Map<Node>
  edgesMap: Y.Map<Edge>
  remoteDragPositions: Record<string, { x: number; y: number }>
  remoteResizeDimensions: ResizingState
}

export function useCanvasDocumentSync({
  nodesMap,
  edgesMap,
  remoteDragPositions,
  remoteResizeDimensions,
}: UseCanvasDocumentSyncOptions) {
  const reactFlow = useReactFlow()
  const draggingIds = useRef(new Set<string>())
  const suppressNodeObserver = useRef(false)
  const suppressEdgeObserver = useRef(false)
  const remoteDragRef = useRef(remoteDragPositions)
  remoteDragRef.current = remoteDragPositions
  const remoteResizeRef = useRef(remoteResizeDimensions)
  remoteResizeRef.current = remoteResizeDimensions

  const springStates = useRef(
    new Map<string, { spring: SpringState; target: { x: number; y: number } }>(),
  )
  const springActiveIds = useRef(new Set<string>())

  const withNodeTransaction = useCallback(
    (fn: () => void) => {
      suppressNodeObserver.current = true
      try {
        if (nodesMap.doc) {
          nodesMap.doc.transact(fn)
        } else {
          fn()
        }
      } finally {
        suppressNodeObserver.current = false
      }
    },
    [nodesMap],
  )

  const withEdgeTransaction = useCallback(
    (fn: () => void) => {
      suppressEdgeObserver.current = true
      try {
        if (edgesMap.doc) {
          edgesMap.doc.transact(fn)
        } else {
          fn()
        }
      } finally {
        suppressEdgeObserver.current = false
      }
    },
    [edgesMap],
  )

  const clearNodeSprings = useCallback((nodeIds: Array<string>) => {
    for (const nodeId of nodeIds) {
      springStates.current.delete(nodeId)
      springActiveIds.current.delete(nodeId)
    }
    if (springStates.current.size === 0) {
      springRunningRef.current = false
      cancelAnimationFrame(springRafIdRef.current)
      springRafIdRef.current = 0
    }
  }, [])

  useEffect(() => {
    reactFlow.setNodes(yMapToArray(nodesMap))

    const handler = () => {
      if (suppressNodeObserver.current) return

      reactFlow.setNodes((current) => {
        const currentById = new Map(current.map((node) => [node.id, node]))
        return yMapToArray(nodesMap).map((remote) => {
          const local = currentById.get(remote.id)
          if (!local) return remote
          if (draggingIds.current.has(remote.id)) {
            return { ...local, ...remote, position: local.position }
          }

          const resizeDimensions = remoteResizeRef.current[remote.id]
          if (resizeDimensions) {
            return {
              ...local,
              ...remote,
              width: resizeDimensions.width,
              height: resizeDimensions.height,
              position: { x: resizeDimensions.x, y: resizeDimensions.y },
            }
          }

          const spring = springStates.current.get(remote.id)
          if (spring) {
            spring.target = remote.position
            return { ...local, ...remote, position: local.position }
          }

          return { ...local, ...remote }
        })
      })
    }

    nodesMap.observe(handler)
    return () => nodesMap.unobserve(handler)
  }, [nodesMap, reactFlow])

  useEffect(() => {
    reactFlow.setEdges(yMapToArray(edgesMap))

    const handler = () => {
      if (suppressEdgeObserver.current) return

      reactFlow.setEdges((current) => {
        const currentById = new Map(current.map((edge) => [edge.id, edge]))
        return yMapToArray(edgesMap).map((remote) => {
          const local = currentById.get(remote.id)
          return local ? { ...local, ...remote } : remote
        })
      })
    }

    edgesMap.observe(handler)
    return () => edgesMap.unobserve(handler)
  }, [edgesMap, reactFlow])

  const prevTimeRef = useRef(0)
  const springRunningRef = useRef(false)
  const springRafIdRef = useRef(0)
  const startSpringLoopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const animate = (time: number) => {
      const dt = Math.min((time - (prevTimeRef.current || time)) / 1000, SPRING_DEFAULTS.maxDt)
      prevTimeRef.current = time

      const targets = remoteDragRef.current
      const targetKeys = Object.keys(targets)
      const springs = springStates.current
      const active = springActiveIds.current

      for (const nodeId of targetKeys) {
        if (!springs.has(nodeId)) {
          springs.set(nodeId, {
            spring: {
              pos: { ...targets[nodeId] },
              vel: { x: 0, y: 0 },
            },
            target: targets[nodeId],
          })
        } else {
          springs.get(nodeId)!.target = targets[nodeId]
        }
        active.add(nodeId)
      }

      const updates = new Map<string, { x: number; y: number }>()
      const settled: Array<string> = []

      for (const [nodeId, springState] of springs) {
        if (draggingIds.current.has(nodeId)) {
          springs.delete(nodeId)
          active.delete(nodeId)
          continue
        }

        const didSettle = stepSpring(springState.spring, springState.target, dt)
        if (didSettle && !(nodeId in targets)) {
          settled.push(nodeId)
        }

        updates.set(nodeId, {
          x: springState.spring.pos.x,
          y: springState.spring.pos.y,
        })
      }

      for (const nodeId of settled) {
        springs.delete(nodeId)
        active.delete(nodeId)
      }

      if (updates.size > 0) {
        reactFlow.setNodes((current) =>
          current.map((node) => {
            if (draggingIds.current.has(node.id)) return node
            const position = updates.get(node.id)
            return position ? { ...node, position } : node
          }),
        )
      }

      if (springs.size === 0) {
        springRunningRef.current = false
        return
      }

      springRafIdRef.current = requestAnimationFrame(animate)
    }

    const startLoop = () => {
      if (springRunningRef.current) return
      springRunningRef.current = true
      prevTimeRef.current = 0
      springRafIdRef.current = requestAnimationFrame(animate)
    }

    startSpringLoopRef.current = startLoop
    return () => {
      springRunningRef.current = false
      cancelAnimationFrame(springRafIdRef.current)
    }
  }, [reactFlow])

  useEffect(() => {
    if (Object.keys(remoteDragPositions).length > 0) {
      startSpringLoopRef.current?.()
    }
  }, [remoteDragPositions])

  useEffect(() => {
    if (Object.keys(remoteResizeDimensions).length === 0) return

    reactFlow.setNodes((current) =>
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
    )
  }, [reactFlow, remoteResizeDimensions])

  const createNode = useCallback(
    (node: Node) => {
      withNodeTransaction(() => {
        nodesMap.set(node.id, node)
      })
    },
    [nodesMap, withNodeTransaction],
  )

  const updateNode = useCallback(
    (nodeId: string, updater: (node: Node) => Node) => {
      withNodeTransaction(() => {
        const existing = nodesMap.get(nodeId)
        if (!existing) return
        nodesMap.set(nodeId, updater(existing))
      })
    },
    [nodesMap, withNodeTransaction],
  )

  const updateNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      updateNode(nodeId, (existing) => ({
        ...existing,
        data: { ...existing.data, ...data },
      }))
    },
    [updateNode],
  )

  const resizeNode = useCallback(
    (nodeId: string, width: number, height: number, position: { x: number; y: number }) => {
      updateNode(nodeId, (existing) => {
        if (isStrokeNode(existing)) {
          return resizeStrokeNode(existing, { width, height, position })
        }

        return { ...existing, width, height, position }
      })
    },
    [updateNode],
  )

  const deleteNodes = useCallback(
    (nodeIds: Array<string>) => {
      if (nodeIds.length === 0) return
      withNodeTransaction(() => {
        for (const nodeId of nodeIds) {
          nodesMap.delete(nodeId)
        }
      })
    },
    [nodesMap, withNodeTransaction],
  )

  const deleteEdges = useCallback(
    (edgeIds: Array<string>) => {
      if (edgeIds.length === 0) return
      withEdgeTransaction(() => {
        for (const edgeId of edgeIds) {
          edgesMap.delete(edgeId)
        }
      })
    },
    [edgesMap, withEdgeTransaction],
  )

  const setNodePosition = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      updateNode(nodeId, (existing) => ({ ...existing, position }))
    },
    [updateNode],
  )

  const setNodeSelection = useCallback(
    (nodeIds: Array<string>) => {
      const nodeIdSet = new Set(nodeIds)
      reactFlow.setNodes((nodes) =>
        nodes.map((node) => {
          const selected = nodeIdSet.has(node.id)
          const draggable = node.draggable ?? true
          if (node.selected === selected && draggable === selected) {
            return node
          }
          return { ...node, selected, draggable: selected }
        }),
      )
      reactFlow.setEdges((edges) =>
        edges.map((edge) => {
          const selected = nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)
          return edge.selected === selected ? edge : { ...edge, selected }
        }),
      )
    },
    [reactFlow],
  )

  const clearSelection = useCallback(() => {
    setNodeSelection([])
  }, [setNodeSelection])

  const createEdge = useCallback(
    (connection: Connection) => {
      const id = `e-${connection.source}-${connection.target}-${crypto.randomUUID()}`
      const edge: Edge = { id, ...connection }

      try {
        reactFlow.addEdges(edge)
        withEdgeTransaction(() => {
          edgesMap.set(id, edge)
        })
      } catch (error) {
        withEdgeTransaction(() => {
          edgesMap.delete(id)
        })
        throw error
      }
    },
    [edgesMap, reactFlow, withEdgeTransaction],
  )

  const onNodeDragStart: OnNodeDrag = useCallback((_event, _node, nodes) => {
    for (const node of nodes) {
      draggingIds.current.add(node.id)
    }
  }, [])

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, _node, nodes) => {
      for (const node of nodes) {
        draggingIds.current.delete(node.id)
      }
      clearNodeSprings(nodes.map((node) => node.id))
      withNodeTransaction(() => {
        for (const node of nodes) {
          const existing = nodesMap.get(node.id)
          if (existing) {
            nodesMap.set(node.id, { ...existing, position: node.position })
          }
        }
      })
    },
    [clearNodeSprings, nodesMap, withNodeTransaction],
  )

  const onNodesDelete: OnNodesDelete = useCallback(
    (deleted) => {
      deleteNodes(deleted.map((node) => node.id))
    },
    [deleteNodes],
  )

  const onEdgesDelete: OnEdgesDelete = useCallback(
    (deleted) => {
      deleteEdges(deleted.map((edge) => edge.id))
    },
    [deleteEdges],
  )

  const onConnect: OnConnect = useCallback(
    (connection) => {
      createEdge(connection)
    },
    [createEdge],
  )

  const documentActions = useMemo<CanvasDocumentActions>(
    () => ({
      createNode,
      updateNode,
      updateNodeData,
      resizeNode,
      deleteNodes,
      createEdge,
      deleteEdges,
      setNodePosition,
      setNodeSelection,
      clearSelection,
      getNodes: () => reactFlow.getNodes(),
      getEdges: () => reactFlow.getEdges(),
    }),
    [
      clearSelection,
      createEdge,
      createNode,
      deleteEdges,
      deleteNodes,
      reactFlow,
      resizeNode,
      setNodePosition,
      setNodeSelection,
      updateNode,
      updateNodeData,
    ],
  )

  const reactFlowHandlers = useMemo(
    () => ({
      onNodeDragStart,
      onNodeDragStop,
      onNodesDelete,
      onEdgesDelete,
      onConnect,
    }),
    [onConnect, onEdgesDelete, onNodeDragStart, onNodeDragStop, onNodesDelete],
  )

  return {
    documentActions,
    reactFlowHandlers,
  }
}
