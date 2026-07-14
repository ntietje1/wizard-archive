import { useRef } from 'react'
import { convexQuery, useConvex } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useConvexYjsCollaboration } from '~/editor-adapters/live/collaboration/yjs-collaboration'

import {
  flushWizardEditorYjsProviderPendingUpdates,
  isWizardEditorYjsProviderApplyingRemoteUpdate,
  useWizardEditorNoteYjsPersistenceLifecycle,
} from '@wizard-archive/editor/adapter'
import type { WizardEditorResourceSlug } from '@wizard-archive/editor/adapter'
import type { YjsCollaborationProvider } from '@wizard-archive/editor/collaboration/yjs-provider'
import { logger } from '~/shared/utils/logger'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'

type ConvexClient = ReturnType<typeof useConvex>
type QueryClient = ReturnType<typeof useQueryClient>
type GetNoteSlugById = (noteId: ResourceId) => WizardEditorResourceSlug | null | undefined
type BeforeDestroyState = {
  sourceId: CampaignId
  documentId: ResourceId
  provider: YjsCollaborationProvider
}

async function flushProviderForPersist(provider: YjsCollaborationProvider, label: string) {
  try {
    const flushed = await flushWizardEditorYjsProviderPendingUpdates(provider)
    if (flushed === false) {
      logger.error(`[Notes] ${label} flush did not drain all updates`)
      return false
    }
    return true
  } catch (err: unknown) {
    logger.error(`[Notes] ${label} flush failed:`, err)
    return false
  }
}

async function invalidatePersistedNoteQueries({
  getNoteSlugById,
  noteId,
  queryClient,
  sourceId,
}: {
  getNoteSlugById: GetNoteSlugById
  noteId: ResourceId
  queryClient: QueryClient
  sourceId: CampaignId
}) {
  const noteValueStatesByNotesQuery = convexQuery(
    api.noteValues.queries.getNoteValueStatesByNotes,
    {
      campaignId: sourceId,
      noteIds: [],
    },
  )
  const invalidations: Array<Promise<unknown>> = [
    queryClient.invalidateQueries({
      queryKey: convexQuery(api.sidebarItems.queries.resolveSidebarItemAccess, {
        campaignId: sourceId,
        lookup: { kind: 'id', id: noteId },
      }).queryKey,
    }),
    queryClient.invalidateQueries({
      queryKey: convexQuery(api.noteValues.queries.getNoteValueStates, {
        campaignId: sourceId,
        noteId,
      }).queryKey,
    }),
    queryClient.invalidateQueries({
      queryKey: [...noteValueStatesByNotesQuery.queryKey.slice(0, -1), { campaignId: sourceId }],
    }),
  ]

  const slug = getNoteSlugById(noteId)
  if (slug) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.sidebarItems.queries.resolveSidebarItemAccess, {
          campaignId: sourceId,
          lookup: { kind: 'slug', slug },
        }).queryKey,
      }),
    )
  }

  await Promise.all(invalidations)
}

async function persistNoteBlocksNow({
  convex,
  getNoteSlugById,
  noteId,
  queryClient,
  sourceId,
}: {
  convex: ConvexClient
  getNoteSlugById: GetNoteSlugById
  noteId: ResourceId
  queryClient: QueryClient
  sourceId: CampaignId
}) {
  const result = await convex.action(api.notes.actions.persistNoteBlocks, {
    campaignId: sourceId,
    documentId: noteId,
  })
  if (result.status === 'rejected') return result
  await invalidatePersistedNoteQueries({ getNoteSlugById, noteId, queryClient, sourceId })
  return result
}

export function useNoteYjsCollaboration(
  sourceId: string | null,
  noteId: ResourceId,
  user: { name: string; color: string },
  canEdit: boolean,
  { getNoteSlugById }: { getNoteSlugById: GetNoteSlugById },
) {
  const convex = useConvex()
  const queryClient = useQueryClient()
  const convexRef = useRef(convex)
  const queryClientRef = useRef(queryClient)
  const getNoteSlugByIdRef = useRef(getNoteSlugById)
  convexRef.current = convex
  queryClientRef.current = queryClient
  getNoteSlugByIdRef.current = getNoteSlugById

  const beforeDestroyRef = useRef((_state: BeforeDestroyState) => Promise.resolve())

  const result = useConvexYjsCollaboration(sourceId, noteId, user, canEdit, {
    onBeforeDestroy: (state) => beforeDestroyRef.current(state),
  })

  const persistence = useWizardEditorNoteYjsPersistenceLifecycle({
    noteId,
    sourceId,
    canEdit,
    session: result,
    adapter: {
      flushProvider: flushProviderForPersist,
      isApplyingRemoteUpdate: isWizardEditorYjsProviderApplyingRemoteUpdate,
      persistNote: (persistedNoteId, persistedSourceId) =>
        persistNoteBlocksNow({
          convex: convexRef.current,
          getNoteSlugById: getNoteSlugByIdRef.current,
          noteId: persistedNoteId,
          queryClient: queryClientRef.current,
          sourceId: persistedSourceId as CampaignId,
        }),
      reportError: (message, err) => logger.error(`[Notes] ${message}:`, err),
    },
  })

  beforeDestroyRef.current = ({ documentId, provider, sourceId: cleanupSourceId }) =>
    persistence.handleBeforeDestroy({
      noteId: documentId,
      sourceId: cleanupSourceId,
      provider,
    })

  return result
}
