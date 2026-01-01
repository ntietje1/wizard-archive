import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { debounce } from 'lodash-es'
import { useNoteActions } from './useNoteActions'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock } from '~/lib/editor-schema'

export function useNoteContent(noteId: Id<'notes'> | undefined) {
  const { updateNoteContentWithSanitization } = useNoteActions()

  const noteQuery = useQuery(
    convexQuery(
      api.notes.queries.getNoteWithContent,
      noteId ? { noteId } : 'skip',
    ),
  )

  const updateContent = useMemo(
    () =>
      debounce((newContent: Array<CustomBlock>) => {
        if (!noteId) return
        updateNoteContentWithSanitization(noteId, newContent)
      }, 800),
    [updateNoteContentWithSanitization, noteId],
  )

  useEffect(() => {
    return () => {
      updateContent.flush()
    }
  }, [noteId, updateContent])

  return {
    content: noteQuery.data?.content,
    note: noteQuery.data,
    updateContent,
    isLoading: noteQuery.isPending,
  }
}

