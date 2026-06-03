import * as Y from 'yjs'
import { useEffect, useRef, useState } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import {
  ConvexYjsProvider,
  applyConvexYjsProviderRemoteAwareness,
  applyConvexYjsProviderRemoteUpdates,
  updateConvexYjsProviderUser,
  setConvexYjsProviderWritable,
} from '../providers/convex-yjs-provider'
import type { YjsDocumentId } from 'shared/yjs-sync/types'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { logger } from '~/shared/utils/logger'
import type { Id } from 'convex/_generated/dataModel'

type YjsState = {
  documentId: YjsDocumentId
  doc: Y.Doc
  provider: ConvexYjsProvider
  instanceId: number
}

let nextInstanceId = 1

export function useConvexYjsCollaboration(
  documentId: YjsDocumentId,
  user: { name: string; color: string },
  canEdit: boolean,
  options?: {
    onBeforeDestroy?: (state: {
      documentId: YjsDocumentId
      campaignId: Id<'campaigns'>
      doc: Y.Doc
      provider: ConvexYjsProvider
    }) => Promise<void> | void
  },
) {
  const convex = useConvex()
  const { campaignId } = useCampaign()
  const [state, setState] = useState<YjsState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [afterSeq, setAfterSeq] = useState<number | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const onBeforeDestroyRef = useRef(options?.onBeforeDestroy)
  onBeforeDestroyRef.current = options?.onBeforeDestroy

  useEffect(() => {
    setIsLoading(true)
    setAfterSeq(undefined)
    setError(null)
    setState(null)

    if (!campaignId) return

    const doc = new Y.Doc()
    const provider = new ConvexYjsProvider(doc, documentId, {
      pushUpdate: (args) =>
        convex.mutation(api.yjsSync.mutations.pushUpdate, {
          ...args,
          campaignId,
          documentId,
        }),
      pushAwareness: (args) =>
        convex.mutation(api.yjsSync.mutations.pushAwareness, {
          ...args,
          campaignId,
          documentId,
        }),
      removeAwareness: (args) =>
        convex.mutation(api.yjsSync.mutations.removeAwareness, {
          ...args,
          campaignId,
          documentId,
        }),
    })

    setState({ documentId, doc, provider, instanceId: nextInstanceId++ })

    return () => {
      const onBeforeDestroy = onBeforeDestroyRef.current
      Promise.resolve(
        onBeforeDestroy?.({
          documentId,
          campaignId,
          doc,
          provider,
        }),
      )
        .catch((err: unknown) => {
          logger.error('[YJS] onBeforeDestroy failed in useConvexYjsCollaboration:', err)
        })
        .finally(() => {
          provider.destroy()
          doc.destroy()
        })
    }
  }, [documentId, convex, campaignId])

  const currentState = state?.documentId === documentId ? state : null

  const { name, color } = user
  useEffect(() => {
    if (currentState) updateConvexYjsProviderUser(currentState.provider, { name, color })
  }, [currentState, name, color])

  useEffect(() => {
    if (currentState) setConvexYjsProviderWritable(currentState.provider, canEdit)
  }, [currentState, canEdit])

  const updatesResult = useCampaignQuery(api.yjsSync.queries.getUpdates, {
    documentId,
    afterSeq,
  })

  useEffect(() => {
    if (updatesResult.isError) {
      setIsLoading(false)
      setError(updatesResult.error)
      return
    }
    if (updatesResult.data && currentState) {
      setError(null)
      applyConvexYjsProviderRemoteUpdates(currentState.provider, updatesResult.data)
      if (updatesResult.data.length > 0) {
        setAfterSeq(currentState.provider.lastAppliedSeq)
      }
      if (isLoading) setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatesResult.data, updatesResult.isError, updatesResult.error, currentState])

  const awarenessResult = useCampaignQuery(api.yjsSync.queries.getAwareness, {
    documentId,
  })

  useEffect(() => {
    if (awarenessResult.data && currentState) {
      applyConvexYjsProviderRemoteAwareness(currentState.provider, awarenessResult.data)
    }
  }, [awarenessResult.data, currentState])

  return {
    doc: currentState?.doc ?? null,
    provider: currentState?.provider ?? null,
    instanceId: currentState?.instanceId ?? 0,
    isLoading: isLoading || !currentState,
    error,
  }
}
