import {
  ContextMenu,
  type ContextMenuRef,
} from '~/components/context-menu/context-menu'
import { forwardRef, useMemo } from 'react'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Note } from 'convex/notes/types'
import { useTagNoteEdit, useTagNoteDelete } from '~/hooks/useTagNoteContextMenu'
import type { Tag } from 'convex/tags/types'
import { TagDeleteConfirmDialog } from '~/components/dialogs/delete/tag-delete-confirm-dialog'

export interface CategoryTagContextMenuProps {
  children: React.ReactNode
  noteWithTag: Note
  categoryConfig: TagCategoryConfig
}

export const CategoryTagContextMenu = forwardRef<
  ContextMenuRef,
  CategoryTagContextMenuProps
>(({ children, noteWithTag, categoryConfig }, ref) => {
  const edit = useTagNoteEdit(noteWithTag, categoryConfig)
  const deleteAction = useTagNoteDelete(noteWithTag, categoryConfig)

  const menuItems = useMemo(
    () => [edit.menuItem, deleteAction.menuItem],
    [edit.menuItem, deleteAction.menuItem],
  )

  return (
    <>
      <ContextMenu ref={ref} items={menuItems}>
        {children}
      </ContextMenu>

      {noteWithTag.tag && (
        <TagDeleteConfirmDialog
          tag={noteWithTag.tag}
          categoryConfig={categoryConfig}
          isDeleting={deleteAction.isDialogOpen}
          onClose={() => deleteAction.setIsDialogOpen(false)}
        />
      )}

      {noteWithTag.tag && (
        <GenericTagDialog
          mode="edit"
          isOpen={edit.isDialogOpen}
          onClose={() => edit.setIsDialogOpen(false)}
          config={categoryConfig}
          tag={noteWithTag.tag as Tag}
        />
      )}
    </>
  )
})
