import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuRef,
} from '~/components/context-menu/base/context-menu'
import { forwardRef, useMemo } from 'react'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Note } from 'convex/notes/types'
import { useTagNoteEdit, useTagNoteDelete } from '~/hooks/useTagNoteContextMenu'
import type { Session } from 'convex/sessions/types'
import { TagDeleteConfirmDialog } from '~/components/dialogs/delete/tag-delete-confirm-dialog'
import GenericTagDialog from '~/components/forms/category-tag-form/generic-tag-form/generic-tag-dialog'

export interface SessionTagContextMenuProps {
  children: React.ReactNode
  noteWithTag: Note & { tag: Session }
  categoryConfig: TagCategoryConfig
}

export const SessionTagContextMenu = forwardRef<
  ContextMenuRef,
  SessionTagContextMenuProps
>(({ children, noteWithTag, categoryConfig }, ref) => {
  const edit = useTagNoteEdit(noteWithTag, categoryConfig)
  const deleteAction = useTagNoteDelete(noteWithTag, categoryConfig)

  const menuItems: Array<ContextMenuItem> = useMemo(
    () => [edit.menuItem, deleteAction.menuItem],
    [edit.menuItem, deleteAction.menuItem],
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

      {noteWithTag.tag && (
        <GenericTagDialog
          mode="edit"
          isOpen={edit.isDialogOpen}
          onClose={() => edit.setIsDialogOpen(false)}
          config={categoryConfig}
          tag={noteWithTag.tag}
        />
      )}
    </>
  )
})
