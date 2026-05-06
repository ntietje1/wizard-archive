import { useEffect, useRef, useState } from 'react'
import {
  parseCanvasAwarenessPresence,
  parseCanvasAwarenessUser,
  parseCanvasPoint2D,
  parseCanvasResizingAwarenessState,
  parseCanvasSelectionAwarenessState,
} from 'convex/canvases/validation'
import type { Awareness } from 'y-protocols/awareness'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'
import { logger } from '~/shared/utils/logger'
import type {
  CanvasAwarenessNamespace,
  CanvasAwarenessPresence,
  RemoteUser,
  ResizingState,
} from '../../utils/canvas-awareness-types'

function buildRemoteUsers(awareness: Awareness, localClientId: number): Array<RemoteUser> {
  const states = awareness.getStates()
  const localState = states.get(localClientId)
  const localUser = parseCanvasAwarenessUser(localState?.user)
  const users: Array<RemoteUser> = []
  states.forEach((state, clientId) => {
    if (clientId === localClientId) return

    const remote = parseCanvasAwarenessUser(state.user)
    if (!remote) return

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
      user: remote,
      presence,
      cursor: parseCanvasPoint2D(presence['core.cursor']),
      resizing: parseCanvasResizingAwarenessState(presence['core.resizing']),
      selectedNodeIds: parseCanvasSelectionAwarenessState(presence['core.selection']),
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

  logger.warn(`${setter}: ignoring invalid local awareness payload from ${parser}`, value)
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
    const currentPresence = readPresence(currentState)
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
  }

  const setLocalSelection = (nodeIds: ReadonlySet<string> | null) => {
    if (nodeIds === null) {
      setLocalPresence('core.selection', null)
      return
    }

    const serializedNodeIds = Array.from(nodeIds)
    const parsedNodeIds = parseCanvasSelectionAwarenessState(serializedNodeIds)
    if (!parsedNodeIds) {
      warnInvalidLocalPresenceUpdate(
        'setLocalSelection',
        'parseCanvasSelectionAwarenessState',
        serializedNodeIds,
      )
      return
    }

    setLocalPresence('core.selection', parsedNodeIds)
  }

  const setLocalResizing = (resizing: ResizingState | null) => {
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
  }

  return {
    remoteUsers,
    core: {
      setLocalCursor,
      setLocalResizing,
      setLocalSelection,
    },
    presence: {
      setPresence: setLocalPresence,
    },
  }
}
