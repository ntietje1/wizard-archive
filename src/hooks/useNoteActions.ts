import { api } from 'convex/_generated/api'
import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'

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

  return {
    updateNote,
    createNote,
    createNoteWithContent,
    deleteNote,
    moveNote,
    updateNoteContent,
  }
}
