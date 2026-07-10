import { useMemo } from 'react'
import type { Doc } from 'yjs'
import { getCanvasDocumentMaps } from './document-contract'
import type { CanvasItemWithContent } from './item-contract'
import type { CanvasCollaborationCapability, CanvasDocumentSession } from './session-contract'

type CanvasDocumentCollaborationSession =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | {
      status: 'ready'
      doc: Doc
      collaboration: CanvasCollaborationCapability
    }

function createReadyCanvasDocumentSession({
  canEdit,
  canvasId,
  colorMode,
  doc,
  parentId,
  collaboration,
  user,
  workspaceId,
}: {
  canEdit: boolean
  canvasId: CanvasItemWithContent['id']
  colorMode: 'light' | 'dark'
  doc: Doc
  parentId: CanvasItemWithContent['parentId']
  collaboration: CanvasCollaborationCapability
  user: { name: string; color: string }
  workspaceId: string
}): Extract<CanvasDocumentSession, { status: 'ready' }> {
  const { edgesMap, nodesMap } = getCanvasDocumentMaps(doc)
  return {
    status: 'ready',
    canvasId,
    workspaceId,
    canEdit,
    colorMode,
    parentId,
    collaboration,
    user,
    doc,
    edgesMap,
    nodesMap,
  }
}

export function useCanvasDocumentSession({
  canvas,
  canEdit,
  collaboration,
  colorMode,
  user,
}: {
  canvas: CanvasItemWithContent
  canEdit: boolean
  collaboration: CanvasDocumentCollaborationSession
  colorMode: 'light' | 'dark'
  user: { name: string; color: string }
}): CanvasDocumentSession {
  const workspaceId: string = canvas.campaignId
  const collaborationStatus =
    collaboration.status === 'ready' ? collaboration.collaboration.status : null
  const provider =
    collaboration.status === 'ready' && collaboration.collaboration.status === 'available'
      ? collaboration.collaboration.provider
      : null
  const doc = collaboration.status === 'ready' ? collaboration.doc : null
  const readySession = useMemo(() => {
    if (!doc || !collaborationStatus) return null
    let readyCollaboration: CanvasCollaborationCapability
    if (collaborationStatus === 'available') {
      if (!provider) return null
      readyCollaboration = { status: 'available', provider }
    } else {
      readyCollaboration =
        collaborationStatus === 'unsupported'
          ? { status: 'unsupported' }
          : { status: 'unavailable' }
    }
    return createReadyCanvasDocumentSession({
      canvasId: canvas.id,
      canEdit,
      collaboration: readyCollaboration,
      colorMode,
      doc,
      parentId: canvas.parentId,
      user,
      workspaceId,
    })
  }, [
    canvas.id,
    canvas.parentId,
    canEdit,
    collaborationStatus,
    colorMode,
    doc,
    provider,
    user,
    workspaceId,
  ])

  if (collaboration.status === 'error') {
    return {
      status: 'error',
      error: collaboration.error,
    }
  }

  if (collaboration.status === 'loading' || !readySession) {
    return { status: 'loading' }
  }

  return readySession
}
