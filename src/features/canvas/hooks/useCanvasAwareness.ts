import { useEffect, useRef, useState } from 'react'
import type { Awareness } from 'y-protocols/awareness'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import type {
  CanvasAwarenessNamespace,
  CanvasAwarenessPresence,
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
    const presence = readPresence(state)
    users.push({
      clientId,
      user: state.user as { name: string; color: string },
      presence,
      cursor: (presence['core.cursor'] as { x: number; y: number } | undefined) ?? null,
      dragging:
        (presence['core.dragging'] as Record<string, { x: number; y: number }> | undefined) ?? null,
      resizing: (presence['core.resizing'] as ResizingState | undefined) ?? null,
      selectedNodeIds: (presence['core.selection'] as Array<string> | undefined) ?? null,
      drawing: (presence['tool.draw'] as DrawingState | undefined) ?? null,
      selecting:
        ((presence['tool.select'] ?? presence['tool.lasso']) as SelectingState | undefined) ?? null,
    })
  })
  return users
}

function readPresence(state: Record<string, unknown>): CanvasAwarenessPresence {
  const storedPresence = state.presence
  if (!storedPresence || typeof storedPresence !== 'object') {
    return {}
  }

  return storedPresence as CanvasAwarenessPresence
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

  const updateLocalPresence = (
    updater: (presence: CanvasAwarenessPresence) => CanvasAwarenessPresence,
  ) => {
    const awareness = awarenessRef.current
    if (!awareness) return

    const currentState = awareness.getLocalState() ?? {}
    const currentPresence = readPresence(currentState as Record<string, unknown>)
    awareness.setLocalStateField('presence', updater(currentPresence))
  }

  const setLocalPresence = (namespace: CanvasAwarenessNamespace, value: unknown) => {
    updateLocalPresence((currentPresence) => {
      const nextPresence = { ...currentPresence }
      if (value === null) {
        delete nextPresence[namespace]
      } else {
        nextPresence[namespace] = value
      }

      return nextPresence
    })
  }

  const setLocalCursor = (pos: { x: number; y: number } | null) => {
    setLocalPresence('core.cursor', pos)
  }

  const setLocalDragging = (positions: Record<string, { x: number; y: number }> | null) => {
    setLocalPresence('core.dragging', positions)
  }

  const setLocalSelection = (nodeIds: Array<string> | null) => {
    setLocalPresence('core.selection', nodeIds)
  }

  const setLocalDrawing = (drawing: DrawingState | null) => {
    setLocalPresence('tool.draw', drawing)
  }

  const setLocalResizing = (resizing: ResizingState | null) => {
    setLocalPresence('core.resizing', resizing)
  }

  const setLocalSelecting = (selecting: SelectingState | null) => {
    updateLocalPresence((currentPresence) => {
      const nextPresence = { ...currentPresence }

      if (selecting?.type === 'lasso') {
        nextPresence['tool.lasso'] = selecting
        delete nextPresence['tool.select']
        return nextPresence
      }

      if (selecting?.type === 'rect') {
        nextPresence['tool.select'] = selecting
        delete nextPresence['tool.lasso']
        return nextPresence
      }

      delete nextPresence['tool.select']
      delete nextPresence['tool.lasso']
      return nextPresence
    })
  }

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
