import { useMemo, useState } from 'react'
import { useCanvasAwareness } from './use-canvas-awareness'
import {
  getRemoteEdgeHighlights,
  getRemoteNodeHighlights,
  getRemoteResizeDimensions,
} from './canvas-remote-state'
import type { CanvasEditSessionState } from '../../tools/canvas-tool-types'
import type { RemoteHighlight, RemoteUser, ResizingState } from '../../utils/canvas-awareness-types'
import type { CanvasCollaborationProvider } from '../../session-contract'

interface UseCanvasSessionStateOptions {
  provider: CanvasCollaborationProvider | null
}

export interface CanvasSessionRuntime {
  editSession: CanvasEditSessionState
  awareness: ReturnType<typeof useCanvasAwareness>
  remoteUsers: ReadonlyArray<RemoteUser>
  remoteResizeDimensions: Readonly<ResizingState>
  remoteNodeHighlights: ReadonlyMap<string, RemoteHighlight>
  remoteEdgeHighlights: ReadonlyMap<string, RemoteHighlight>
}

function getCanvasRemoteSessionState(remoteUsers: Array<RemoteUser>) {
  return {
    remoteResizeDimensions: getRemoteResizeDimensions(remoteUsers),
    remoteNodeHighlights: getRemoteNodeHighlights(remoteUsers),
    remoteEdgeHighlights: getRemoteEdgeHighlights(remoteUsers),
  }
}

export function useCanvasSessionState({ provider }: UseCanvasSessionStateOptions) {
  const [editingEmbedId, setEditingEmbedId] = useState<string | null>(null)
  const [pendingEdit, setPendingEdit] = useState<CanvasEditSessionState['pendingEdit']>(null)
  const awareness = useCanvasAwareness(provider)
  const remoteUsers = awareness.remoteUsers
  const { remoteResizeDimensions, remoteNodeHighlights, remoteEdgeHighlights } = useMemo(
    () => getCanvasRemoteSessionState(remoteUsers),
    [remoteUsers],
  )

  const editSession = useMemo(
    () =>
      ({
        editingEmbedId,
        setEditingEmbedId,
        pendingEdit,
        setPendingEdit,
      }) satisfies CanvasEditSessionState,
    [editingEmbedId, pendingEdit],
  )

  return useMemo(
    () =>
      ({
        editSession,
        awareness,
        remoteUsers,
        remoteResizeDimensions,
        remoteNodeHighlights,
        remoteEdgeHighlights,
      }) satisfies CanvasSessionRuntime,
    [
      awareness,
      editSession,
      remoteEdgeHighlights,
      remoteNodeHighlights,
      remoteResizeDimensions,
      remoteUsers,
    ],
  )
}
