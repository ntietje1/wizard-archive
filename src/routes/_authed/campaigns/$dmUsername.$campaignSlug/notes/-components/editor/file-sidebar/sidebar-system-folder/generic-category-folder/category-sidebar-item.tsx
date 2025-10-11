import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useCurrentNote } from '~/hooks/useCurrentNote'
import { useNoteActions } from '~/hooks/useNoteActions'
import type { ComponentType } from 'react'
import {
  TagNoteContextMenu,
  type TagNoteContextMenuProps,
} from './tag-note-context.menu'
import { SidebarItemButtonBase } from '../../sidebar-item/sidebar-item-button-base'
import type { TagCategoryConfig } from '~/components/forms/category-tag-dialogs/base-tag-dialog/types'
import {
  SIDEBAR_ITEM_TYPES,
  UNTITLED_NOTE_TITLE,
  type AnySidebarItem,
  type Note,
} from 'convex/notes/types'
import { CategoryFolderButton } from './category-folder-button'
import type { CategoryContextMenuProps } from './category-context-menu'
import { DraggableNote } from '../../sidebar-note/draggable-note'
import { FileEdit, FileText } from '~/lib/icons'
import { useContextMenu } from '~/hooks/useContextMenu'

interface CategorySidebarItemProps {
  item: AnySidebarItem
  categoryConfig: TagCategoryConfig
  categoryContextMenu?: ComponentType<CategoryContextMenuProps>
  tagNoteContextMenu?: ComponentType<TagNoteContextMenuProps>
  ancestorIds?: string[]
}

export const CategorySidebarItem = ({
  item,
  categoryConfig,
  categoryContextMenu,
  tagNoteContextMenu,
  ancestorIds = [],
}: CategorySidebarItemProps) => {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.folders:
      return (
        <CategoryFolderButton
          folder={item}
          categoryConfig={categoryConfig}
          categoryContextMenu={categoryContextMenu}
          tagNoteContextMenu={tagNoteContextMenu}
          ancestorIds={ancestorIds}
        />
      )
    case SIDEBAR_ITEM_TYPES.notes:
      return (
        <TagNoteButton
          noteWithTag={item}
          categoryConfig={categoryConfig}
          contextMenuComponent={tagNoteContextMenu}
        />
      )

    default:
      throw new Error('Invalid item type or missing required properties')
  }
}

interface TagNoteButtonProps {
  noteWithTag: Note
  categoryConfig: TagCategoryConfig
  contextMenuComponent?: ComponentType<TagNoteContextMenuProps>
}

export function TagNoteButton({
  noteWithTag,
  categoryConfig,
  contextMenuComponent,
}: TagNoteButtonProps) {
  const { renamingId, setRenamingId } = useFileSidebar()
  const { note: currentNote, selectNote } = useCurrentNote()
  const { updateNote } = useNoteActions()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const isSelected = currentNote?.data?._id === noteWithTag._id

  const handleFinishRename = async (name: string) => {
    await updateNote.mutateAsync({ noteId: noteWithTag._id, name })
    setRenamingId(null)
  }

  const ContextMenuComponent = contextMenuComponent || TagNoteContextMenu

  return (
    <ContextMenuComponent
      ref={contextMenuRef}
      noteWithTag={noteWithTag}
      categoryConfig={categoryConfig}
    >
      <DraggableNote note={noteWithTag}>
        <SidebarItemButtonBase
          icon={FileText}
          editIcon={FileEdit}
          name={noteWithTag.name || ''}
          defaultName={UNTITLED_NOTE_TITLE}
          isSelected={isSelected}
          isRenaming={renamingId === noteWithTag._id}
          showChevron={false}
          onSelect={() => selectNote(noteWithTag.slug)}
          onMoreOptions={handleMoreOptions}
          onFinishRename={handleFinishRename}
        />
      </DraggableNote>
    </ContextMenuComponent>
  )
}
