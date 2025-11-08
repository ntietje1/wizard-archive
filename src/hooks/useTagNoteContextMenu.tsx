import { useState, useCallback, useMemo } from 'react'
import { FileEdit, Pencil, Trash2 } from '~/lib/icons'
import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { toast } from 'sonner'
import { useCurrentNote } from '~/hooks/useCurrentNote'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Note } from 'convex/notes/types'
import type { ContextMenuItem } from '~/components/context-menu/context-menu'

export function useTagNoteRename(noteWithTag: Note) {
  const { setRenamingId } = useFileSidebar()

  const handleRename = useCallback(() => {
    setRenamingId(noteWithTag._id)
  }, [noteWithTag._id, setRenamingId])

  const menuItem: ContextMenuItem = useMemo(
    () => ({
      type: 'action' as const,
      label: 'Rename',
      icon: <FileEdit className="h-4 w-4" />,
      onClick: handleRename,
    }),
    [handleRename],
  )

  return {
    menuItem,
  }
}

export function useTagNoteEdit(
  noteWithTag: Note,
  categoryConfig: TagCategoryConfig,
) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleEdit = useCallback(() => {
    setIsDialogOpen(true)
  }, [])

  const menuItem: ContextMenuItem = useMemo(
    () => ({
      type: 'action' as const,
      label: `Edit ${categoryConfig.singular}`,
      icon: <Pencil className="h-4 w-4" />,
      onClick: handleEdit,
    }),
    [handleEdit, categoryConfig.singular],
  )

  return {
    menuItem,
    isDialogOpen,
    setIsDialogOpen,
  }
}

export function useTagNoteDelete(
  noteWithTag: Note,
  categoryConfig: TagCategoryConfig,
) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { note: currentNote, selectNote } = useCurrentNote()
  const deleteTag = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.deleteTag),
  })
  const tag = noteWithTag.tag

  const handleDelete = useCallback(() => {
    setIsDialogOpen(true)
  }, [])

  const confirmDeleteTag = useCallback(async () => {
    if (!tag) {
      toast.error('An error occurred while deleting the tag')
      return
    }

    await deleteTag
      .mutateAsync({ tagId: tag._id })
      .then(() => {
        toast.success(`${tag.displayName} deleted successfully`)
        if (currentNote.data?._id === noteWithTag._id) {
          selectNote(null)
        }
      })
      .catch((error) => {
        console.error(error)
        toast.error(
          `Failed to delete ${noteWithTag.category?.displayName}: ${tag.displayName}`,
        )
      })
      .finally(() => {
        setIsDialogOpen(false)
      })
  }, [
    deleteTag,
    tag,
    currentNote.data?._id,
    noteWithTag._id,
    noteWithTag.category,
    selectNote,
  ])

  const menuItem: ContextMenuItem = useMemo(
    () => ({
      type: 'action' as const,
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: handleDelete,
      className: 'text-red-600 focus:text-red-600',
    }),
    [handleDelete],
  )

  return {
    menuItem,
    isDialogOpen,
    setIsDialogOpen,
    confirmDeleteTag,
    tag,
  }
}
