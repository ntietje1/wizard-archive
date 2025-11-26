import { useMutation } from '@tanstack/react-query'
import type { Id } from 'convex/_generated/dataModel'
import { useNoteActions } from './useNoteActions'

/**
 * useFolderActions - Wrapper around useNoteActions for creating "folder" notes
 * Folders are now just notes that don't automatically create pages
 */
export const useFolderActions = () => {
  const { createNote, updateNote, deleteNote, moveNote } = useNoteActions()

  const createFolder = useMutation({
    mutationFn: async (params: {
      name?: string
      parentId?: Id<'notes'>
      campaignId: Id<'campaigns'>
      categoryId?: Id<'tagCategories'>
    }) => {
      // Create note without page (folder behavior)
      const result = await createNote.mutateAsync({
        ...params,
        createPage: false,
      })
      return result.noteId
    },
  })

  const updateFolder = useMutation({
    mutationFn: async (params: { folderId: Id<'notes'>; name: string }) => {
      return await updateNote.mutateAsync({
        noteId: params.folderId,
        name: params.name,
      })
    },
  })

  const deleteFolder = useMutation({
    mutationFn: async (params: { folderId: Id<'notes'> }) => {
      return await deleteNote.mutateAsync({
        noteId: params.folderId,
      })
    },
  })

  const moveFolder = useMutation({
    mutationFn: async (params: {
      folderId: Id<'notes'>
      parentId?: Id<'notes'>
    }) => {
      return await moveNote.mutateAsync({
        noteId: params.folderId,
        parentId: params.parentId,
      })
    },
  })

  return {
    createFolder,
    updateFolder,
    deleteFolder,
    moveFolder,
  }
}
