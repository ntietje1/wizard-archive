import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { debounce } from 'lodash-es'
import { useNoteActions } from './useNoteActions'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomPartialBlock } from '~/lib/editor-schema'

export function useNoteContent(noteId: Id<'notes'>) {
  const { updateNoteContentWithSanitization } = useNoteActions()

  const sharedNoteQuery = useQuery({
    ...convexQuery(api.notes.queries.getNoteWithSharedContent, { noteId }),
  })

  const updateContent = useMemo(
    () =>
      debounce((newContent: Array<CustomPartialBlock>) => {
        updateNoteContentWithSanitization(noteId, newContent)
      }, 800),
    [updateNoteContentWithSanitization, noteId],
  )

  useEffect(() => {
    return () => {
      updateContent.flush()
    }
  }, [updateContent])

  return {
    sharedNoteQuery,
    updateContent,
  }
}
