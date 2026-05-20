import * as Y from 'yjs'
import { useEffect, useRef } from 'react'
import { convexQuery, useConvex } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useConvexYjsCollaboration } from './useConvexYjsCollaboration'
import type { Id } from 'convex/_generated/dataModel'
import type { ConvexYjsProvider } from '../providers/convex-yjs-provider'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { logger } from '~/shared/utils/logger'

export const PERSIST_INTERVAL_MS = 10_000
export const LIVE_YJS_PERSIST_DEBOUNCE_MS = 750

type ConvexClient = ReturnType<typeof useConvex>
type QueryClient = ReturnType<typeof useQueryClient>
type ActiveSidebarItems = ReturnType<typeof useActiveSidebarItems>['data']

type PersistLifecycle = {
  active: boolean
  timeoutId: ReturnType<typeof setTimeout> | null
  isPersisting: boolean
  persistAgain: boolean
  persistPromise: Promise<unknown>
}

function createPersistLifecycle(): PersistLifecycle {
  return {
    active: false,
    timeoutId: null,
    isPersisting: false,
    persistAgain: false,
    persistPromise: Promise.resolve(),
  }
}

function stopPersistLifecycle(lifecycle: PersistLifecycle) {
  lifecycle.active = false
  lifecycle.persistAgain = false
  if (lifecycle.timeoutId !== null) {
    clearTimeout(lifecycle.timeoutId)
    lifecycle.timeoutId = null
  }
}

function encodeDocUpdateAsArrayBuffer(doc: Y.Doc): ArrayBuffer {
  const update = Y.encodeStateAsUpdate(doc)
  return update.buffer.slice(
    update.byteOffset,
    update.byteOffset + update.byteLength,
  ) as ArrayBuffer
}

async function invalidatePersistedNoteQueries({
  campaignId,
  noteId,
  queryClient,
  sidebarItems,
}: {
  campaignId: Id<'campaigns'>
  noteId: Id<'sidebarItems'>
  queryClient: QueryClient
  sidebarItems: ActiveSidebarItems
}) {
  const invalidations: Array<Promise<unknown>> = [
    queryClient.invalidateQueries({
      queryKey: convexQuery(api.noteValues.queries.getNoteValueStates, {
        campaignId,
        noteId,
      }).queryKey,
    }),
  ]

  const item = sidebarItems.find((sidebarItem) => sidebarItem._id === noteId)
  if (item) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.sidebarItems.queries.getSidebarItemBySlug, {
          campaignId,
          slug: item.slug,
        }).queryKey,
      }),
    )
  }

  await Promise.all(invalidations)
}

async function persistNoteBlocksNow({
  campaignId,
  convex,
  noteId,
  queryClient,
  sidebarItems,
}: {
  campaignId: Id<'campaigns'>
  convex: ConvexClient
  noteId: Id<'sidebarItems'>
  queryClient: QueryClient
  sidebarItems: ActiveSidebarItems
}) {
  await convex.mutation(api.notes.mutations.persistNoteBlocks, {
    campaignId,
    documentId: noteId,
  })
  await invalidatePersistedNoteQueries({ campaignId, noteId, queryClient, sidebarItems })
}

export function useNoteYjsCollaboration(
  noteId: Id<'sidebarItems'>,
  user: { name: string; color: string },
  canEdit: boolean,
) {
  const convex = useConvex()
  const queryClient = useQueryClient()
  const { campaignId } = useCampaign()
  const { data: sidebarItems } = useActiveSidebarItems()
  const convexRef = useRef(convex)
  const queryClientRef = useRef(queryClient)
  const sidebarItemsRef = useRef(sidebarItems)
  convexRef.current = convex
  queryClientRef.current = queryClient
  sidebarItemsRef.current = sidebarItems

  const lifecycleKey = `${noteId}:${campaignId ?? ''}`
  const persistLifecycleRef = useRef<{ key: string; value: PersistLifecycle } | null>(null)
  if (!persistLifecycleRef.current || persistLifecycleRef.current.key !== lifecycleKey) {
    persistLifecycleRef.current = {
      key: lifecycleKey,
      value: createPersistLifecycle(),
    }
  }
  const persistLifecycle = persistLifecycleRef.current.value

  const cleanupPersist = async ({
    doc,
    documentId,
    provider,
  }: {
    doc: Y.Doc
    documentId: Id<'sidebarItems'>
    provider: ConvexYjsProvider
  }) => {
    stopPersistLifecycle(persistLifecycle)

    if (!canEdit || !campaignId) {
      return
    }

    const activeCampaignId = campaignId
    const finalUpdate = encodeDocUpdateAsArrayBuffer(doc)

    try {
      const flushed = await provider.flushPendingUpdates()
      if (!flushed) {
        logger.error(`[Notes] flush before persist did not drain all updates for ${documentId}`)
      }
    } catch (err: unknown) {
      logger.error(`[Notes] flush before persist failed for ${documentId}:`, err)
    }

    try {
      await persistLifecycle.persistPromise
    } catch {
      // The scheduled persist path logs failures already.
    }

    try {
      await convexRef.current.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: activeCampaignId,
        documentId,
        update: finalUpdate,
      })
    } catch (err: unknown) {
      logger.error(`[Notes] final Yjs sync failed for ${documentId}:`, err)
    }

    try {
      await persistNoteBlocksNow({
        campaignId: activeCampaignId,
        convex: convexRef.current,
        noteId: documentId,
        queryClient: queryClientRef.current,
        sidebarItems: sidebarItemsRef.current,
      })
    } catch (err: unknown) {
      logger.error(`[Notes] cleanup persist failed for ${documentId}:`, err)
    }
  }

  const result = useConvexYjsCollaboration(noteId, user, canEdit, {
    onBeforeDestroy: cleanupPersist,
  })

  useEffect(() => {
    if (!canEdit || result.isLoading || !campaignId) return

    const activeCampaignId = campaignId
    const lifecycle = persistLifecycleRef.current?.value
    if (!lifecycle) return
    lifecycle.active = true

    const persist = () => {
      lifecycle.timeoutId = null
      if (lifecycle.isPersisting) {
        lifecycle.persistAgain = true
        if (lifecycle.active) {
          lifecycle.timeoutId = setTimeout(persist, PERSIST_INTERVAL_MS)
        }
        return
      }
      lifecycle.isPersisting = true

      lifecycle.persistPromise = (async () => {
        try {
          if (result.provider) {
            const flushed = await result.provider.flushPendingUpdates()
            if (!flushed) {
              logger.error(`[Notes] persist flush did not drain all updates for ${noteId}`)
            }
          }
          await persistNoteBlocksNow({
            campaignId: activeCampaignId,
            convex: convexRef.current,
            noteId,
            queryClient: queryClientRef.current,
            sidebarItems: sidebarItemsRef.current,
          })
        } catch (err: unknown) {
          logger.error(`[Notes] persist failed for ${noteId}:`, err)
        } finally {
          lifecycle.isPersisting = false
          if (lifecycle.persistAgain && lifecycle.active) {
            lifecycle.persistAgain = false
            lifecycle.timeoutId = setTimeout(persist, 0)
          } else if (lifecycle.active) {
            lifecycle.timeoutId = setTimeout(persist, PERSIST_INTERVAL_MS)
          }
        }
      })()
    }

    lifecycle.timeoutId = setTimeout(persist, PERSIST_INTERVAL_MS)

    return () => {
      stopPersistLifecycle(lifecycle)
    }
  }, [noteId, canEdit, result.isLoading, campaignId, result.provider])

  useEffect(() => {
    if (!canEdit || result.isLoading || !campaignId || !result.doc || !result.provider) {
      return
    }

    const activeCampaignId = campaignId
    const provider = result.provider
    const lifecycle = persistLifecycleRef.current?.value
    if (!lifecycle) return
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let active = true

    const schedulePersist = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        timeoutId = null
        runPersist()
      }, LIVE_YJS_PERSIST_DEBOUNCE_MS)
    }

    const runPersist = () => {
      if (lifecycle.isPersisting) {
        lifecycle.persistAgain = true
        return
      }

      lifecycle.isPersisting = true
      lifecycle.persistPromise = (async () => {
        try {
          const flushed = await provider.flushPendingUpdates()
          if (!flushed) {
            logger.error(`[Notes] live Yjs flush did not drain all updates for ${noteId}`)
          }
          await persistNoteBlocksNow({
            campaignId: activeCampaignId,
            convex: convexRef.current,
            noteId,
            queryClient: queryClientRef.current,
            sidebarItems: sidebarItemsRef.current,
          })
        } catch (err: unknown) {
          logger.error(`[Notes] live Yjs persist failed for ${noteId}:`, err)
        } finally {
          lifecycle.isPersisting = false
          if (lifecycle.persistAgain && active) {
            lifecycle.persistAgain = false
            schedulePersist()
          }
        }
      })()
    }

    const handleDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === provider && provider.isApplyingRemoteUpdate) {
        return
      }
      schedulePersist()
    }

    result.doc.on('update', handleDocUpdate)
    return () => {
      active = false
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      result.doc?.off('update', handleDocUpdate)
    }
  }, [campaignId, canEdit, noteId, result.doc, result.isLoading, result.provider])

  return result
}
