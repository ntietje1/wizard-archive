import { useState } from 'react'
import { useCanvasAwareness } from './useCanvasAwareness'
import {
  getRemoteDragPositions,
  getRemoteHighlights,
  getRemoteResizeDimensions,
} from '../utils/canvas-remote-state'
import type { CanvasEditSessionState } from '../tools/canvas-tool-types'
import type { ConvexYjsProvider } from '~/features/editor/providers/convex-yjs-provider'

interface UseCanvasSessionStateOptions {
  provider: ConvexYjsProvider | null
  user: { name: string; color: string }
}

export function useCanvasSessionState({ provider, user }: UseCanvasSessionStateOptions) {
  const [editingEmbedId, setEditingEmbedId] = useState<string | null>(null)
  const [pendingEditNodeId, setPendingEditNodeId] = useState<string | null>(null)
  const awareness = useCanvasAwareness(provider)

  const editSession: CanvasEditSessionState = {
    editingEmbedId,
    setEditingEmbedId,
    pendingEditNodeId,
    setPendingEditNodeId,
  }

  return {
    user,
    editSession,
    awareness,
    remoteUsers: awareness.remoteUsers,
    remoteDragPositions: getRemoteDragPositions(awareness.remoteUsers),
    remoteResizeDimensions: getRemoteResizeDimensions(awareness.remoteUsers),
    remoteHighlights: getRemoteHighlights(awareness.remoteUsers),
  }
}
