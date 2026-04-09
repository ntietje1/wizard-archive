import { useCallback, useEffect, useRef, useState } from 'react'
import type { Awareness } from 'y-protocols/awareness'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import type {
  DrawingState,
  RemoteUser,
  ResizingState,
  SelectingState,
} from '../utils/canvas-awareness-types'

function buildRemoteUsers(awareness: Awareness, localClientId: number): Array<RemoteUser> {
  const states = awareness.getStates()
  const localState = states.get(localClientId)
  const localUser = localState?.user as { name: string; color: string } | undefined
  const users: Array<RemoteUser> = []
  states.forEach((state, clientId) => {
    if (clientId === localClientId || !state.user) return
    const remote = state.user as { name: string; color: string }
    if (
      // TODO: identify users by unique id rather than name/color
      localUser &&
      remote.name === localUser.name &&
      remote.color === localUser.color
    )
      return
    users.push({
      clientId,
      user: state.user as { name: string; color: string },
      cursor: (state.cursor as { x: number; y: number } | undefined) ?? null,
      dragging: (state.dragging as Record<string, { x: number; y: number }> | undefined) ?? null,
      resizing: (state.resizing as ResizingState | undefined) ?? null,
      selectedNodeIds: (state.selectedNodeIds as Array<string> | undefined) ?? null,
      drawing: (state.drawing as DrawingState | undefined) ?? null,
      selecting: (state.selecting as SelectingState | undefined) ?? null,
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
    const localClientId = awareness.clientID

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

  const setLocalResizing = useCallback((resizing: ResizingState | null) => {
    awarenessRef.current?.setLocalStateField('resizing', resizing)
  }, [])

  const setLocalSelecting = useCallback((selecting: SelectingState | null) => {
    awarenessRef.current?.setLocalStateField('selecting', selecting)
  }, [])

  return {
    remoteUsers,
    setLocalCursor,
    setLocalDragging,
    setLocalResizing,
    setLocalSelection,
    setLocalDrawing,
    setLocalSelecting,
  }
}
