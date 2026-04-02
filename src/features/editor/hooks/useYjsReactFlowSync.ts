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
import type * as Y from 'yjs'

function yMapToArray<T>(map: Y.Map<T>): Array<T> {
  const items: Array<T> = []
  map.forEach((value) => items.push(value))
  return items
}

export function useYjsReactFlowSync(
  nodesMap: Y.Map<Node> | null,
  edgesMap: Y.Map<Edge> | null,
) {
  const reactFlow = useReactFlow()
  const draggingIds = useRef(new Set<string>())
  const suppressNodeObserver = useRef(false)
  const suppressEdgeObserver = useRef(false)

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

  const onNodeDragStart: OnNodeDrag = useCallback((_event, _node, nodes) => {
    for (const n of nodes) draggingIds.current.add(n.id)
  }, [])

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, _node, nodes) => {
      if (!nodesMap) return
      suppressNodeObserver.current = true
      for (const n of nodes) {
        draggingIds.current.delete(n.id)
        const existing = nodesMap.get(n.id)
        if (existing) {
          nodesMap.set(n.id, { ...existing, position: n.position })
        }
      }
      suppressNodeObserver.current = false
    },
    [nodesMap],
  )

  const onNodesDelete: OnNodesDelete = useCallback(
    (deleted) => {
      if (!nodesMap) return
      suppressNodeObserver.current = true
      for (const node of deleted) nodesMap.delete(node.id)
      suppressNodeObserver.current = false
    },
    [nodesMap],
  )

  const onEdgesDelete: OnEdgesDelete = useCallback(
    (deleted) => {
      if (!edgesMap) return
      suppressEdgeObserver.current = true
      for (const edge of deleted) edgesMap.delete(edge.id)
      suppressEdgeObserver.current = false
    },
    [edgesMap],
  )

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!edgesMap) return
      const id = `e-${connection.source}-${connection.target}-${crypto.randomUUID()}`
      const edge: Edge = { id, ...connection }
      reactFlow.addEdges(edge)
      suppressEdgeObserver.current = true
      edgesMap.set(id, edge)
      suppressEdgeObserver.current = false
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
