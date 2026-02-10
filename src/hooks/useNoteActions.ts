import { api } from 'convex/_generated/api'
import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'

export const useNoteActions = () => {
  const createNote = useMutation({
    mutationFn: useConvexMutation(api.notes.mutations.createNote),
  })
  const updateNoteContent = useMutation({
    mutationFn: useConvexMutation(api.notes.mutations.updateNoteContent),
  })

  return {
    createNote,
    updateNoteContent,
  }
}
