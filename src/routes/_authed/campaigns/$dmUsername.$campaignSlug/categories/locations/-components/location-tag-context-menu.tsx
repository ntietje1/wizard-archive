import {
  ContextMenu,
  type ContextMenuRef,
} from '~/components/context-menu/context-menu'
import { forwardRef, useMemo } from 'react'
import { Trash2 } from '~/lib/icons'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import LocationTagDialog from '~/components/forms/category-tag-form/location-tag-form/location-tag-dialog'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Note } from 'convex/notes/types'
import { useTagNoteEdit, useTagNoteDelete } from '~/hooks/useTagNoteContextMenu'
import type { Location } from 'convex/locations/types'

export interface LocationTagContextMenuProps {
  children: React.ReactNode
  noteWithTag: Note
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
        <ConfirmationDialog
          isOpen={deleteAction.isDialogOpen}
          onClose={() => deleteAction.setIsDialogOpen(false)}
          onConfirm={deleteAction.confirmDeleteTag}
          title={`Delete ${categoryConfig.singular}`}
          description={`Are you sure you want to delete this ${categoryConfig.singular}? This will also remove references in your notes. This action cannot be undone.`}
          confirmLabel={`Delete ${deleteAction.tag.displayName}`}
          confirmVariant="destructive"
          icon={Trash2}
        />
      )}

      {noteWithTag.tag && (
        <LocationTagDialog
          mode="edit"
          isOpen={edit.isDialogOpen}
          onClose={() => edit.setIsDialogOpen(false)}
          config={categoryConfig}
          tag={noteWithTag.tag as Location}
        />
      )}
    </>
  )
})
