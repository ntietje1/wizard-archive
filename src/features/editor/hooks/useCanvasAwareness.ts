import { useCallback, useEffect, useRef, useState } from 'react'
import type { Awareness } from 'y-protocols/awareness'
import type { ConvexYjsProvider } from '../providers/convex-yjs-provider'
import type { RemoteUser } from '../components/viewer/canvas/canvas-awareness-types'

function buildRemoteUsers(
  awareness: Awareness,
  localClientId: number,
): Array<RemoteUser> {
  const users: Array<RemoteUser> = []
  awareness.getStates().forEach((state, clientId) => {
    if (clientId === localClientId || !state.user) return
    users.push({
      clientId,
      user: state.user as { name: string; color: string },
      cursor: (state.cursor as { x: number; y: number } | null) ?? null,
      dragging:
        (state.dragging as Record<string, { x: number; y: number }> | null) ??
        null,
      selectedNodeIds: (state.selectedNodeIds as Array<string> | null) ?? null,
    })
  })
  return users
}

export function useCanvasAwareness(provider: ConvexYjsProvider | null) {
  const [remoteUsers, setRemoteUsers] = useState<Array<RemoteUser>>([])
  const awarenessRef = useRef<Awareness | null>(null)

  useEffect(() => {
    if (!provider) return

    const awareness = provider.awareness
    awarenessRef.current = awareness
    const localClientId = provider.doc.clientID

    const handler = () => {
      setRemoteUsers(buildRemoteUsers(awareness, localClientId))
    }

    handler()
    awareness.on('change', handler)
    return () => {
      awareness.off('change', handler)
      awarenessRef.current = null
    }
  }, [provider])

  const setLocalCursor = useCallback((pos: { x: number; y: number } | null) => {
    awarenessRef.current?.setLocalStateField('cursor', pos)
  }, [])

  const setLocalDragging = useCallback(
    (positions: Record<string, { x: number; y: number }> | null) => {
      awarenessRef.current?.setLocalStateField('dragging', positions)
    },
    [],
  )

  const setLocalSelection = useCallback((nodeIds: Array<string> | null) => {
    awarenessRef.current?.setLocalStateField('selectedNodeIds', nodeIds)
  }, [])

  return { remoteUsers, setLocalCursor, setLocalDragging, setLocalSelection }
}
