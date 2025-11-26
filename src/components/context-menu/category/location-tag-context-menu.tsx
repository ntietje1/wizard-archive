import {
  ContextMenu,
  type ContextMenuRef,
} from '~/components/context-menu/base/context-menu'
import { forwardRef, useMemo } from 'react'
import LocationTagDialog from '~/components/forms/category-tag-form/location-tag-form/location-tag-dialog'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Note } from 'convex/notes/types'
import { useTagNoteEdit, useTagNoteDelete } from '~/hooks/useTagNoteContextMenu'
import type { Location } from 'convex/locations/types'
import { TagDeleteConfirmDialog } from '~/components/dialogs/delete/tag-delete-confirm-dialog'

export interface LocationTagContextMenuProps {
  children: React.ReactNode
  noteWithTag: Note & { tag: Location }
  categoryConfig: TagCategoryConfig
}

export const LocationTagContextMenu = forwardRef<
  ContextMenuRef,
  LocationTagContextMenuProps
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

      {deleteAction.tag && (
        <TagDeleteConfirmDialog
          tag={deleteAction.tag}
          categoryConfig={categoryConfig}
          isDeleting={deleteAction.isDialogOpen}
          onClose={() => deleteAction.setIsDialogOpen(false)}
        />
      )}

      {noteWithTag.tag && (
        <LocationTagDialog
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
