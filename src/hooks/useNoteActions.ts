import { api } from 'convex/_generated/api'
import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomPartialBlock } from '~/lib/editor-schema'

export const useNoteActions = () => {
  const updateNote = useMutation({
    mutationFn: useConvexMutation(api.notes.mutations.updateNote),
  })
  const createNote = useMutation({
    mutationFn: useConvexMutation(api.notes.mutations.createNote),
  })
  const createNoteWithContent = useMutation({
    mutationFn: useConvexMutation(api.notes.mutations.createNoteWithContent),
  })
  const deleteNote = useMutation({
    mutationFn: useConvexMutation(api.notes.mutations.deleteNote),
  })
  const moveNote = useMutation({
    mutationFn: useConvexMutation(api.notes.mutations.moveNote),
  })
  const updateNoteContent = useMutation({
    mutationFn: useConvexMutation(api.notes.mutations.updateNoteContent),
  })

  const updateNoteContentWithSanitization = useCallback(
    async (noteId: Id<'notes'>, payload: Array<CustomPartialBlock>) => {
      const sanitized = sanitizeNoteContent(payload)
      await updateNoteContent.mutateAsync({
        noteId,
        content: sanitized,
      })
    },
    [updateNoteContent],
  )

  return {
    updateNote,
    createNote,
    createNoteWithContent,
    deleteNote,
    moveNote,
    updateNoteContent,
    updateNoteContentWithSanitization,
  }
}

// remove undefined values (caused issues with undefined values in tables)
// TODO: still causes issues sometimes
const sanitizeNoteContent = (node: any): any => {
  if (typeof node === 'string') {
    return node
  }
  if (Array.isArray(node)) {
    return node.map(sanitizeNoteContent)
  }
  if (node && typeof node === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(node)) {
      if (key !== '_id' && key !== '__typename') {
        sanitized[key] = sanitizeNoteContent(value)
      }
    }
    return sanitized
  }
  return node
}
