import {
  ContextMenu,
  type ContextMenuRef,
} from '~/components/context-menu/context-menu'
import { forwardRef, useMemo } from 'react'
import CharacterTagDialog from '~/components/forms/category-tag-form/character-tag-form/character-tag-dialog'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import type { Note } from 'convex/notes/types'
import { useTagNoteEdit, useTagNoteDelete } from '~/hooks/useTagNoteContextMenu'
import type { Character } from 'convex/characters/types'
import { TagDeleteConfirmDialog } from '~/components/dialogs/delete/tag-delete-confirm-dialog'

export interface CharacterTagContextMenuProps {
  children: React.ReactNode
  noteWithTag: Note
  categoryConfig: TagCategoryConfig
}

export const CharacterTagContextMenu = forwardRef<
  ContextMenuRef,
  CharacterTagContextMenuProps
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
        <CharacterTagDialog
          mode="edit"
          isOpen={edit.isDialogOpen}
          onClose={() => edit.setIsDialogOpen(false)}
          config={categoryConfig}
          tag={noteWithTag.tag as Character}
        />
      )}
    </>
  )
})
