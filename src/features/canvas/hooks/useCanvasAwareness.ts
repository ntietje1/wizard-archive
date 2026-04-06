import { useCallback, useEffect, useRef, useState } from 'react'
import type { Awareness } from 'y-protocols/awareness'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import type {
  DrawingState,
  RemoteUser,
  SelectingState,
} from '../utils/canvas-awareness-types'

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
      drawing: (state.drawing as DrawingState | null) ?? null,
      selecting: (state.selecting as SelectingState | null) ?? null,
    })
  })
  return users
}

export function useCanvasAwareness(provider: ConvexYjsProvider | null) {
  const [remoteUsers, setRemoteUsers] = useState<Array<RemoteUser>>([])
  const awarenessRef = useRef<Awareness | null>(null)

  useEffect(() => {
    if (!provider) {
      setRemoteUsers([])
      awarenessRef.current = null
      return
    }

    const awareness = provider.awareness
    awarenessRef.current = awareness
    const localClientId = provider.doc.clientID

    const handler = ({
      added,
      updated,
      removed,
    }: {
      added: Array<number>
      updated: Array<number>
      removed: Array<number>
    }) => {
      const remoteChanged =
        added.some((id) => id !== localClientId) ||
        updated.some((id) => id !== localClientId) ||
        removed.some((id) => id !== localClientId)
      if (!remoteChanged) return

      setRemoteUsers(buildRemoteUsers(awareness, localClientId))
    }

    setRemoteUsers(buildRemoteUsers(awareness, localClientId))
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

  const setLocalDrawing = useCallback((drawing: DrawingState | null) => {
    awarenessRef.current?.setLocalStateField('drawing', drawing)
  }, [])

  const setLocalSelecting = useCallback((selecting: SelectingState | null) => {
    awarenessRef.current?.setLocalStateField('selecting', selecting)
  }, [])

  return {
    remoteUsers,
    setLocalCursor,
    setLocalDragging,
    setLocalSelection,
    setLocalDrawing,
    setLocalSelecting,
  }
}
