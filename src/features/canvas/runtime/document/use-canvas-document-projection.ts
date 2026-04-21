import { useEffect, useLayoutEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { yMapToArray } from '../../utils/canvas-yjs-utils'
import { stripEphemeralCanvasNodeState } from '../../utils/canvas-node-persistence'
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
      sortCanvasElementsByZIndex(yMapToArray(nodesMap).map(stripEphemeralCanvasNodeState)),
    )

    const handler = () => {
      reactFlow.setNodes((current) => {
        const currentById = new Map(current.map((node) => [node.id, node]))
        return sortCanvasElementsByZIndex(
          yMapToArray(nodesMap).map(stripEphemeralCanvasNodeState),
        ).map((remote) => {
          const local = currentById.get(remote.id)
          if (!local) return remote

          if (localDraggingIdsRef.current?.has(remote.id)) {
            return { ...local, ...remote, position: local.position }
          }

          const resizeDimensions = remoteResizeDimensionsRef.current[remote.id]
          if (resizeDimensions) {
            return {
              ...local,
              ...remote,
              width: resizeDimensions.width,
              height: resizeDimensions.height,
              position: { x: resizeDimensions.x, y: resizeDimensions.y },
            }
          }

          if (remoteDragAnimationRef.current.hasSpring(remote.id)) {
            remoteDragAnimationRef.current.setTarget(remote.id, remote.position)
            return { ...local, ...remote, position: local.position }
          }

          return { ...local, ...remote }
        })
      })
    }

    nodesMap.observe(handler)
    return () => nodesMap.unobserve(handler)
  }, [localDraggingIdsRef, nodesMap, reactFlow])

  useEffect(() => {
    reactFlow.setEdges(sortCanvasElementsByZIndex(yMapToArray(edgesMap)))

    const handler = () => {
      reactFlow.setEdges((current) => {
        const currentById = new Map(current.map((edge) => [edge.id, edge]))
        return sortCanvasElementsByZIndex(yMapToArray(edgesMap)).map((remote) => {
          const local = currentById.get(remote.id)
          return local ? { ...local, ...remote } : remote
        })
      })
    }

    edgesMap.observe(handler)
    return () => edgesMap.unobserve(handler)
  }, [edgesMap, reactFlow])

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
}
