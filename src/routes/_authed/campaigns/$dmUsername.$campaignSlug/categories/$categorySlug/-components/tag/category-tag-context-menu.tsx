import {
  ContextMenu,
  type ContextMenuRef,
} from '~/components/context-menu/context-menu'
import { forwardRef, useMemo } from 'react'
import { Trash2 } from '~/lib/icons'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Note } from 'convex/notes/types'
import { useTagNoteEdit, useTagNoteDelete } from '~/hooks/useTagNoteContextMenu'
import type { Tag } from 'convex/tags/types'

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
        <ConfirmationDialog
          isOpen={deleteAction.isDialogOpen}
          onClose={() => deleteAction.setIsDialogOpen(false)}
          onConfirm={deleteAction.confirmDeleteTag}
          title={`Delete ${categoryConfig.singular}`}
          description={`Are you sure you want to delete this ${categoryConfig.singular}? This will also remove references in your notes. This action cannot be undone.`}
          confirmLabel={`Delete ${noteWithTag.tag.displayName}`}
          confirmVariant="destructive"
          icon={Trash2}
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
