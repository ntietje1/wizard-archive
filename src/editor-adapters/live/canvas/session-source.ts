import { api } from 'convex/_generated/api'
import { useEffect } from 'react'
import {
  createWizardEditorCanvasEmbeddedSessionPorts,
  createWizardEditorCanvasSessionPorts,
  isPersistedWizardEditorItemId,
  useWizardEditorCanvasDocumentSession,
  useWizardEditorEmbeddedCanvasStateFromUpdates,
} from '@wizard-archive/editor/adapter'
import { useResolvedTheme } from '@wizard-archive/ui/theme/context'
import { useAuthPaginatedQuery } from '~/shared/hooks/useAuthPaginatedQuery'
import { useConvexYjsCollaboration } from '~/editor-adapters/live/collaboration/yjs-collaboration'
import { useLiveCollaborationUser } from '~/editor-adapters/live/collaboration/use-live-collaboration-user'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'shared/common/ids'
import type {
  WizardEditorCanvasEmbeddedSessionPorts,
  WizardEditorCanvasEmbeddedSessionPortsInput,
  WizardEditorCanvasSessionPorts,
  WizardEditorCanvasSessionPortsInput,
  WizardEditorCanvasDocumentCollaborationSession,
  WizardEditorEmbeddedCanvasUpdateSource,
} from '@wizard-archive/editor/adapter'

const EMBEDDED_CANVAS_YJS_PAGE_SIZE = 100

type LiveCanvasSessionPortsInput = Omit<WizardEditorCanvasSessionPortsInput, 'documentSession'> & {
  workspaceId: string
}

export function useLiveCanvasSessionSource(
  input: LiveCanvasSessionPortsInput,
): WizardEditorCanvasSessionPorts {
  const { workspaceId, ...sourceInput } = input
  return createWizardEditorCanvasSessionPorts({
    ...sourceInput,
    documentSession: {
      useCanvasDocumentSession: (sessionInput) =>
        useLiveCanvasDocumentSession({ ...sessionInput, workspaceId }),
    },
  })
}

type LiveCanvasEmbeddedSessionPortsInput = Omit<
  WizardEditorCanvasEmbeddedSessionPortsInput,
  'embeddedCanvas'
> & {
  workspaceId: string
}

export function useLiveCanvasEmbeddedSessionSource({
  workspaceId,
}: LiveCanvasEmbeddedSessionPortsInput): WizardEditorCanvasEmbeddedSessionPorts {
  return createWizardEditorCanvasEmbeddedSessionPorts({
    embeddedCanvas: {
      useEmbeddedCanvasState: (canvasId) => useLiveEmbeddedCanvasState(workspaceId, canvasId),
    },
  })
}

type LiveCanvasDocumentSessionInput = Parameters<
  WizardEditorCanvasSessionPortsInput['documentSession']['useCanvasDocumentSession']
>[0] & {
  workspaceId: string
}

function useLiveCanvasDocumentSession({
  canEdit,
  canvas,
  workspaceId,
}: LiveCanvasDocumentSessionInput): ReturnType<
  WizardEditorCanvasSessionPorts['document']['useCanvasDocumentSession']
> {
  const resolvedTheme = useResolvedTheme()
  const { isLoading: userLoading, user } = useLiveCollaborationUser()

  const collaboration = useConvexYjsCollaboration(
    liveCanvasWorkspaceRecordId(workspaceId),
    canvas.id,
    user,
    canEdit,
  )

  return useWizardEditorCanvasDocumentSession({
    canvas,
    canEdit,
    collaboration: resolveLiveCanvasDocumentCollaboration(collaboration, userLoading),
    colorMode: resolvedTheme,
    user,
  })
}

function resolveLiveCanvasDocumentCollaboration(
  collaboration: ReturnType<typeof useConvexYjsCollaboration>,
  userLoading: boolean,
): WizardEditorCanvasDocumentCollaborationSession {
  if (collaboration.error !== null && collaboration.error !== undefined) {
    return { status: 'error', error: collaboration.error }
  }
  if (userLoading || collaboration.isLoading || !collaboration.doc) {
    return { status: 'loading' }
  }
  return {
    status: 'ready',
    doc: collaboration.doc,
    collaboration: collaboration.provider
      ? { status: 'available', provider: collaboration.provider }
      : { status: 'unavailable' },
  }
}

function useLiveEmbeddedCanvasState(workspaceId: string, canvasId: SidebarItemId) {
  return useWizardEditorEmbeddedCanvasStateFromUpdates({
    canvasId,
    useUpdates: (input) => useLiveEmbeddedCanvasUpdates({ ...input, workspaceId }),
  })
}

const useLiveEmbeddedCanvasUpdates = ({
  afterSeq,
  canvasId,
  workspaceId,
}: Parameters<WizardEditorEmbeddedCanvasUpdateSource>[0] & { workspaceId: string }) => {
  const persistedCanvasId = isPersistedWizardEditorItemId(canvasId) ? canvasId : null
  const updatesResult = useAuthPaginatedQuery(
    api.yjsSync.queries.getUpdates,
    persistedCanvasId
      ? {
          campaignId: liveCanvasWorkspaceRecordId(workspaceId),
          documentId: persistedCanvasId as Id<'sidebarItems'>,
          afterSeq: afterSeq ?? null,
        }
      : 'skip',
    { initialNumItems: EMBEDDED_CANVAS_YJS_PAGE_SIZE },
  )
  const { loadMore, results, status } = updatesResult
  const queryState = updatesResult as typeof updatesResult & { isError?: boolean }

  useEffect(() => {
    if (persistedCanvasId && status === 'CanLoadMore') {
      loadMore(EMBEDDED_CANVAS_YJS_PAGE_SIZE)
    }
  }, [loadMore, persistedCanvasId, status])

  return {
    data: persistedCanvasId && status !== 'Exhausted' ? undefined : results,
    isError: queryState.isError === true,
  }
}

function liveCanvasWorkspaceRecordId(workspaceId: string): Id<'campaigns'> {
  return workspaceId as Id<'campaigns'>
}
