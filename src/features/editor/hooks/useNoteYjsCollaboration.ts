import { useEffect, useRef } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useConvexYjsCollaboration } from './useConvexYjsCollaboration'
import type { Id } from 'convex/_generated/dataModel'
import { logger } from '~/shared/utils/logger'

export const PERSIST_INTERVAL_MS = 10_000

export function useNoteYjsCollaboration(
  noteId: Id<'notes'>,
  user: { name: string; color: string },
  canEdit: boolean,
) {
  const convex = useConvex()
  const result = useConvexYjsCollaboration(noteId, user, canEdit)
  const isPersistingRef = useRef(false)
  const pendingCleanupPersistRef = useRef(false)
  const generationRef = useRef(0)

  useEffect(() => {
    if (!canEdit || result.isLoading) return

    const generation = ++generationRef.current
    isPersistingRef.current = false
    pendingCleanupPersistRef.current = false

    let active = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const persist = () => {
      if (generation !== generationRef.current) return
      if (isPersistingRef.current) return
      isPersistingRef.current = true
      convex
        .mutation(api.notes.mutations.persistNoteBlocks, {
          documentId: noteId,
        })
        .catch((err: unknown) => {
          logger.error(`[Notes] persist failed for ${noteId}:`, err)
        })
        .finally(() => {
          isPersistingRef.current = false
          if (pendingCleanupPersistRef.current) {
            pendingCleanupPersistRef.current = false
            persist()
          } else if (active) {
            timeoutId = setTimeout(persist, PERSIST_INTERVAL_MS)
          }
        })
    }

    timeoutId = setTimeout(persist, PERSIST_INTERVAL_MS)

    return () => {
      active = false
      if (timeoutId !== null) clearTimeout(timeoutId)
      if (isPersistingRef.current) {
        pendingCleanupPersistRef.current = true
      } else {
        persist()
      }
    }
  }, [noteId, canEdit, result.isLoading, convex])

  return result
}
