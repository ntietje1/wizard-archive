import { useEffect } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useConvexYjsCollaboration } from './useConvexYjsCollaboration'
import type { Id } from 'convex/_generated/dataModel'

export const PERSIST_INTERVAL_MS = 10_000

export function useNoteYjsCollaboration(
  noteId: Id<'notes'>,
  user: { name: string; color: string },
  canEdit: boolean,
) {
  const convex = useConvex()
  const result = useConvexYjsCollaboration(noteId, user, canEdit)

  useEffect(() => {
    if (!canEdit || result.isLoading) return

    let active = true
    let isPersisting = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const persist = () => {
      if (isPersisting) return
      isPersisting = true
      convex
        .mutation(api.notes.mutations.persistNoteBlocks, {
          documentId: noteId,
        })
        .catch((err: unknown) => {
          console.error(`[Notes] persist failed for ${noteId}:`, err)
        })
        .finally(() => {
          isPersisting = false
          if (active) {
            timeoutId = setTimeout(persist, PERSIST_INTERVAL_MS)
          }
        })
    }

    timeoutId = setTimeout(persist, PERSIST_INTERVAL_MS)

    return () => {
      active = false
      if (timeoutId !== null) clearTimeout(timeoutId)
      persist()
    }
  }, [noteId, canEdit, result.isLoading, convex])

  return result
}
