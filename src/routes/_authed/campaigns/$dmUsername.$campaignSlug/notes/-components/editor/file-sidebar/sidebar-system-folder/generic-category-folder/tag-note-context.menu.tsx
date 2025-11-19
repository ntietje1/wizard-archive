import {
  ContextMenu,
  type ContextMenuRef,
} from '~/components/context-menu/context-menu'
import { forwardRef, useMemo } from 'react'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Note } from 'convex/notes/types'
import {
  useTagNoteRename,
  useTagNoteEdit,
  useTagNoteDelete,
} from '~/hooks/useTagNoteContextMenu'
import { TagDeleteConfirmDialog } from '~/components/dialogs/delete/tag-delete-confirm-dialog'

export interface TagNoteContextMenuProps {
  children: React.ReactNode
  noteWithTag: Note
  categoryConfig: TagCategoryConfig
}

export const TagNoteContextMenu = forwardRef<
  ContextMenuRef,
  TagNoteContextMenuProps
>(({ children, noteWithTag, categoryConfig }, ref) => {
  const rename = useTagNoteRename(noteWithTag)
  const edit = useTagNoteEdit(noteWithTag, categoryConfig)
  const deleteAction = useTagNoteDelete(noteWithTag, categoryConfig)

  const menuItems = useMemo(
    () => [rename.menuItem, edit.menuItem, deleteAction.menuItem],
    [rename.menuItem, edit.menuItem, deleteAction.menuItem],
  )

  return (
    <>
      <ContextMenu ref={ref} items={menuItems}>
        {children}
      </ContextMenu>

      {deleteAction.tag && (
        <TagDeleteConfirmDialog
          tag={deleteAction.tag}
          categoryConfig={categoryConfig}
          isDeleting={deleteAction.isDialogOpen}
          onClose={() => deleteAction.setIsDialogOpen(false)}
        />
      )}

      {deleteAction.tag && (
        <GenericTagDialog
          mode="edit"
          isOpen={edit.isDialogOpen}
          onClose={() => edit.setIsDialogOpen(false)}
          config={categoryConfig}
          tag={deleteAction.tag}
        />
      )}
    </>
  )
})
