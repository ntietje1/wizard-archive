import { useMemo, useState } from 'react'
import { useCanvasAwareness } from './use-canvas-awareness'
import { getRemoteHighlights, getRemoteResizeDimensions } from './canvas-remote-state'
import type { CanvasEditSessionState } from '../../tools/canvas-tool-types'
import type { RemoteHighlight, RemoteUser, ResizingState } from '../../utils/canvas-awareness-types'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'

interface UseCanvasSessionStateOptions {
  provider: ConvexYjsProvider | null
}

export interface CanvasSessionRuntime {
  editSession: CanvasEditSessionState
  awareness: ReturnType<typeof useCanvasAwareness>
  remoteUsers: Array<RemoteUser>
  remoteResizeDimensions: ResizingState
  remoteHighlights: Map<string, RemoteHighlight>
}

function getCanvasRemoteSessionState(remoteUsers: Array<RemoteUser>) {
  return {
    remoteResizeDimensions: getRemoteResizeDimensions(remoteUsers),
    remoteHighlights: getRemoteHighlights(remoteUsers),
  }
}

export function useCanvasSessionState({ provider }: UseCanvasSessionStateOptions) {
  const [editingEmbedId, setEditingEmbedId] = useState<string | null>(null)
  const [pendingEditNodeId, setPendingEditNodeId] = useState<string | null>(null)
  const [pendingEditNodePoint, setPendingEditNodePoint] = useState<{ x: number; y: number } | null>(
    null,
  )
  const awareness = useCanvasAwareness(provider)
  const remoteUsers = awareness.remoteUsers
  const { remoteResizeDimensions, remoteHighlights } = useMemo(
    () => getCanvasRemoteSessionState(remoteUsers),
    [remoteUsers],
  )

  const editSession = useMemo(
    () => ({
      editingEmbedId,
      setEditingEmbedId,
      pendingEditNodeId,
      pendingEditNodePoint,
      setPendingEditNodeId,
      setPendingEditNodePoint,
    }),
    [editingEmbedId, pendingEditNodeId, pendingEditNodePoint],
  ) satisfies CanvasEditSessionState

  return {
    editSession,
    awareness,
    remoteUsers,
    remoteResizeDimensions,
    remoteHighlights,
  } satisfies CanvasSessionRuntime
}
