import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  parseCanvasAwarenessPresence,
  parseCanvasAwarenessUser,
  parseCanvasResizingAwarenessState,
} from '../../awareness'
import {
  parseCanvasSelectionAwarenessState,
  serializeCanvasSelectionAwarenessState,
} from '../../selection-awareness'
import { parseCanvasPoint2D } from '../../geometry'
import type { Awareness } from 'y-protocols/awareness'
import { canvasDevLogger } from '../../internal/dev-logger'
import type {
  CanvasAwarenessNamespace,
  CanvasAwarenessPresence,
  RemoteUser,
  ResizingState,
} from '../../utils/canvas-awareness-types'
import type { CanvasCollaborationProvider } from '../../session-contract'
import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'

function buildRemoteUsers(awareness: Awareness, localClientId: number): Array<RemoteUser> {
  const states = awareness.getStates()
  const users: Array<RemoteUser> = []
  states.forEach((state, clientId) => {
    if (clientId === localClientId) return

    const remote = parseCanvasAwarenessUser(state.user)
    if (!remote) return

    const presence = readPresence(state)
    users.push({
      clientId,
      user: remote,
      presence,
      cursor: parseCanvasPoint2D(presence['core.cursor']),
      resizing: parseCanvasResizingAwarenessState(presence['core.resizing']),
      selection: parseCanvasSelectionAwarenessState(presence['core.selection']),
    })
  })
  return users
}

function readPresence(state: unknown): CanvasAwarenessPresence {
  if (!state || typeof state !== 'object' || !('presence' in state)) {
    return {}
  }

  return parseCanvasAwarenessPresence(state.presence) ?? {}
}

function warnInvalidLocalPresenceUpdate(setter: string, parser: string, value: unknown) {
  if (!import.meta.env.DEV) {
    return
  }

  canvasDevLogger.warn(`${setter}: ignoring invalid local awareness payload from ${parser}`, value)
}

export function useCanvasAwareness(provider: CanvasCollaborationProvider | null) {
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

  const updateLocalPresence = useCallback(
    (updater: (presence: CanvasAwarenessPresence) => CanvasAwarenessPresence) => {
      const awareness = awarenessRef.current
      if (!awareness) return

      const currentState = awareness.getLocalState() ?? {}
      const currentPresence = readPresence(currentState)
      awareness.setLocalStateField('presence', updater(currentPresence))
    },
    [],
  )

  const setLocalPresence = useCallback(
    (namespace: CanvasAwarenessNamespace, value: unknown) => {
      updateLocalPresence((currentPresence) => {
        const nextPresence = { ...currentPresence }
        if (value === null) {
          delete nextPresence[namespace]
        } else {
          nextPresence[namespace] = value
        }

        return nextPresence
      })
    },
    [updateLocalPresence],
  )

  const setLocalCursor = useCallback(
    (pos: { x: number; y: number } | null) => {
      if (pos === null) {
        setLocalPresence('core.cursor', null)
        return
      }

      const parsedPosition = parseCanvasPoint2D(pos)
      if (!parsedPosition) {
        warnInvalidLocalPresenceUpdate('setLocalCursor', 'parseCanvasPoint2D', pos)
        return
      }

      setLocalPresence('core.cursor', parsedPosition)
    },
    [setLocalPresence],
  )

  const setLocalSelection = useCallback(
    (selection: CanvasSelectionSnapshot | null) => {
      if (selection === null) {
        setLocalPresence('core.selection', null)
        return
      }

      const parsedSelection = serializeCanvasSelectionAwarenessState(selection)
      if (!parsedSelection) {
        warnInvalidLocalPresenceUpdate(
          'setLocalSelection',
          'serializeCanvasSelectionAwarenessState',
          selection,
        )
        return
      }

      setLocalPresence('core.selection', parsedSelection)
    },
    [setLocalPresence],
  )

  const setLocalResizing = useCallback(
    (resizing: ResizingState | null) => {
      if (resizing === null) {
        setLocalPresence('core.resizing', null)
        return
      }

      const parsedResizing = parseCanvasResizingAwarenessState(resizing)
      if (!parsedResizing) {
        warnInvalidLocalPresenceUpdate(
          'setLocalResizing',
          'parseCanvasResizingAwarenessState',
          resizing,
        )
        return
      }

      setLocalPresence('core.resizing', parsedResizing)
    },
    [setLocalPresence],
  )

  const core = useMemo(
    () => ({
      setLocalCursor,
      setLocalResizing,
      setLocalSelection,
    }),
    [setLocalCursor, setLocalResizing, setLocalSelection],
  )
  const presence = useMemo(
    () => ({
      setPresence: setLocalPresence,
    }),
    [setLocalPresence],
  )

  return useMemo(
    () => ({
      remoteUsers,
      core,
      presence,
    }),
    [core, presence, remoteUsers],
  )
}
