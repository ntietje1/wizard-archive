import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useAuthPaginatedQuery } from '~/shared/hooks/useAuthPaginatedQuery'
import { logger } from '~/shared/utils/logger'

import { useWizardEditorYjsCollaborationSession } from '@wizard-archive/editor/adapter'
import type { YjsCollaborationProvider } from '@wizard-archive/editor/collaboration/yjs-provider'
import type { Doc } from 'yjs'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'

const YJS_SYNC_PAGE_SIZE = 100

export function useConvexYjsCollaboration(
  initialSourceId: CampaignId | null,
  documentId: ResourceId,
  user: { name: string; color: string },
  canEdit: boolean,
  options?: {
    onBeforeDestroy?: (state: {
      documentId: ResourceId
      sourceId: CampaignId
      doc: Doc
      provider: YjsCollaborationProvider
    }) => Promise<void> | void
  },
) {
  const convex = useConvex()

  return useWizardEditorYjsCollaborationSession({
    canEdit,
    documentId,
    onBeforeDestroy: options?.onBeforeDestroy
      ? async ({ doc, documentId: cleanupDocumentId, provider, sourceId }) => {
          await options.onBeforeDestroy?.({
            sourceId: yjsWorkspaceRecordId(sourceId),
            doc,
            documentId: cleanupDocumentId,
            provider,
          })
        }
      : undefined,
    sourceId: initialSourceId,
    transport: {
      pushUpdate: async ({ documentId: updateDocumentId, revision, sourceId, update }) => {
        return convex.mutation(api.yjsSync.mutations.pushUpdate, {
          campaignId: yjsWorkspaceRecordId(sourceId),
          documentId: updateDocumentId,
          revision,
          update,
        })
      },
      pushAwareness: async ({
        clientId,
        documentId: awarenessDocumentId,
        leaseId,
        sourceId,
        state,
      }) => {
        return convex.mutation(api.yjsSync.mutations.pushAwareness, {
          campaignId: yjsWorkspaceRecordId(sourceId),
          clientId,
          documentId: awarenessDocumentId,
          leaseId,
          state,
        })
      },
      removeAwareness: async ({ clientId, documentId: awarenessDocumentId, leaseId, sourceId }) => {
        return convex.mutation(api.yjsSync.mutations.removeAwareness, {
          campaignId: yjsWorkspaceRecordId(sourceId),
          clientId,
          documentId: awarenessDocumentId,
          leaseId,
        })
      },
      reportError: (message, err) => logger.error(`[YJS] ${message}`, err),
    },
    useAwareness: useConvexYjsAwareness,
    user,
    useUpdates: useConvexYjsUpdates,
  })
}

function yjsWorkspaceRecordId(sourceId: string | null | undefined): CampaignId {
  if (!sourceId) {
    throw new Error('Yjs workspace source id is required')
  }
  return assertDomainId(DOMAIN_ID_KIND.campaign, sourceId)
}

function useConvexYjsUpdates({
  afterSeq,
  documentId,
  sourceId,
}: {
  afterSeq?: number
  documentId: ResourceId
  sourceId: string | null | undefined
}) {
  const query = useAuthPaginatedQuery(
    api.yjsSync.queries.getUpdates,
    sourceId
      ? {
          campaignId: yjsWorkspaceRecordId(sourceId),
          documentId,
          afterSeq: afterSeq ?? null,
        }
      : 'skip',
    { initialNumItems: YJS_SYNC_PAGE_SIZE },
  )

  return toYjsLoad(query)
}

function useConvexYjsAwareness({
  afterSeq: _afterSeq,
  documentId,
  sourceId,
}: {
  afterSeq?: number
  documentId: ResourceId
  sourceId: string | null | undefined
}) {
  const query = useAuthPaginatedQuery(
    api.yjsSync.queries.getAwareness,
    sourceId
      ? {
          campaignId: yjsWorkspaceRecordId(sourceId),
          documentId,
        }
      : 'skip',
    { initialNumItems: YJS_SYNC_PAGE_SIZE },
  )

  return toYjsLoad(query)
}

function toYjsLoad<T>({
  loadMore,
  results,
  status,
}: {
  loadMore: (numItems: number) => void
  results: Array<T>
  status: string
}) {
  const isLoadingFirstPage = status === 'LoadingFirstPage'
  const canLoadMore = status === 'CanLoadMore'
  const isComplete = status === 'Exhausted'

  return {
    data: isLoadingFirstPage ? undefined : results,
    isComplete,
    loadMore: canLoadMore ? () => loadMore(YJS_SYNC_PAGE_SIZE) : undefined,
  }
}
