import { useCallback, useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import type {
  Connection,
  Edge,
  Node,
  OnConnect,
  OnEdgesDelete,
  OnNodeDrag,
  OnNodesDelete,
} from '@xyflow/react'
import type { ResizingState } from '~/features/canvas/utils/canvas-awareness-types'
import type * as Y from 'yjs'
import type { SpringState } from '~/shared/hooks/useSpringPosition'
import { SPRING_DEFAULTS, stepSpring } from '~/shared/hooks/useSpringPosition'

function yMapToArray<T>(map: Y.Map<T>): Array<T> {
  const items: Array<T> = []
  map.forEach((value) => items.push(value))
  return items
}

export function useYjsReactFlowSync(
  nodesMap: Y.Map<Node> | null,
  edgesMap: Y.Map<Edge> | null,
  remoteDragPositions: Record<string, { x: number; y: number }>,
  remoteResizeDimensions: ResizingState = {},
) {
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

  useEffect(() => {
    if (!nodesMap) return

    reactFlow.setNodes(yMapToArray(nodesMap))

    const handler = () => {
      if (suppressNodeObserver.current) return

      reactFlow.setNodes((current) => {
        const currentById = new Map(current.map((n) => [n.id, n]))
        return yMapToArray(nodesMap).map((remote) => {
          const local = currentById.get(remote.id)
          if (!local) return remote
          if (draggingIds.current.has(remote.id)) {
            return { ...local, ...remote, position: local.position }
          }
          const resizeDims = remoteResizeRef.current[remote.id]
          if (resizeDims) {
            return {
              ...local,
              ...remote,
              width: resizeDims.width,
              height: resizeDims.height,
              position: { x: resizeDims.x, y: resizeDims.y },
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
    if (!edgesMap) return

    reactFlow.setEdges(yMapToArray(edgesMap))

    const handler = () => {
      if (suppressEdgeObserver.current) return

      reactFlow.setEdges((current) => {
        const currentById = new Map(current.map((e) => [e.id, e]))
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
    const startLoop = () => {
      if (springRunningRef.current) return
      springRunningRef.current = true
      prevTimeRef.current = 0
      springRafIdRef.current = requestAnimationFrame(animate)
    }

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

      for (const [nodeId, s] of springs) {
        if (draggingIds.current.has(nodeId)) {
          springs.delete(nodeId)
          active.delete(nodeId)
          continue
        }

        const didSettle = stepSpring(s.spring, s.target, dt)

        if (didSettle && !(nodeId in targets)) {
          settled.push(nodeId)
        }

        updates.set(nodeId, { x: s.spring.pos.x, y: s.spring.pos.y })
      }

      for (const nodeId of settled) {
        springs.delete(nodeId)
        active.delete(nodeId)
      }

      if (updates.size > 0) {
        reactFlow.setNodes((current) =>
          current.map((node) => {
            if (draggingIds.current.has(node.id)) return node
            const pos = updates.get(node.id)
            if (pos) return { ...node, position: pos }
            return node
          }),
        )
      }

      if (springs.size === 0) {
        springRunningRef.current = false
        return
      }

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
    const entries = Object.entries(remoteResizeDimensions)
    if (entries.length === 0) return

    reactFlow.setNodes((current) =>
      current.map((node) => {
        const dims = remoteResizeDimensions[node.id]
        if (!dims) return node
        return {
          ...node,
          width: dims.width,
          height: dims.height,
          position: { x: dims.x, y: dims.y },
        }
      }),
    )
  }, [remoteResizeDimensions, reactFlow])

  const onNodeDragStart: OnNodeDrag = useCallback((_event, _node, nodes) => {
    for (const n of nodes) draggingIds.current.add(n.id)
  }, [])

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, _node, nodes) => {
      for (const n of nodes) draggingIds.current.delete(n.id)
      if (!nodesMap?.doc) return
      suppressNodeObserver.current = true
      try {
        nodesMap.doc.transact(() => {
          for (const n of nodes) {
            const existing = nodesMap.get(n.id)
            if (existing) {
              nodesMap.set(n.id, { ...existing, position: n.position })
            }
          }
        })
      } finally {
        suppressNodeObserver.current = false
      }
    },
    [nodesMap],
  )

  const onNodesDelete: OnNodesDelete = useCallback(
    (deleted) => {
      if (!nodesMap?.doc) return
      suppressNodeObserver.current = true
      try {
        nodesMap.doc.transact(() => {
          for (const node of deleted) nodesMap.delete(node.id)
        })
      } finally {
        suppressNodeObserver.current = false
      }
    },
    [nodesMap],
  )

  const onEdgesDelete: OnEdgesDelete = useCallback(
    (deleted) => {
      if (!edgesMap?.doc) return
      suppressEdgeObserver.current = true
      try {
        edgesMap.doc.transact(() => {
          for (const edge of deleted) edgesMap.delete(edge.id)
        })
      } finally {
        suppressEdgeObserver.current = false
      }
    },
    [edgesMap],
  )

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!edgesMap?.doc) return
      const id = `e-${connection.source}-${connection.target}-${crypto.randomUUID()}`
      const edge: Edge = { id, ...connection }
      suppressEdgeObserver.current = true
      try {
        edgesMap.doc.transact(() => {
          edgesMap.set(id, edge)
        })
        reactFlow.addEdges(edge)
      } finally {
        suppressEdgeObserver.current = false
      }
    },
    [edgesMap, reactFlow],
  )

  return {
    onNodeDragStart,
    onNodeDragStop,
    onNodesDelete,
    onEdgesDelete,
    onConnect,
  }
}
