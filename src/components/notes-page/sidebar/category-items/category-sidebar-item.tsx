import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useCurrentNote } from '~/hooks/useCurrentNote'
import { useNoteActions } from '~/hooks/useNoteActions'
import type { ComponentType } from 'react'
import {
  TagNoteContextMenu,
  type TagNoteContextMenuProps,
} from '~/components/context-menu/sidebar/generic/tag-note-context-menu'
import { SidebarItemButtonBase } from '../sidebar-item/sidebar-item-button-base'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import {
  SIDEBAR_ITEM_TYPES,
  type AnySidebarItem,
} from 'convex/sidebarItems/types'
import { UNTITLED_NOTE_TITLE, type Note } from 'convex/notes/types'
import { CategoryFolderButton } from './category-folder-button'
import type { CategoryContextMenuProps } from '~/components/context-menu/sidebar/generic/category-folder-context-menu'
import { DraggableNote } from '../normal-items/sidebar-note/draggable-note'
import { FileText } from '~/lib/icons'
import { useContextMenu } from '~/hooks/useContextMenu'
import type { Id } from 'convex/_generated/dataModel'
import { MapButton } from '../normal-items/sidebar-map/map-button'

interface CategorySidebarItemProps {
  item: AnySidebarItem
  categoryConfig: TagCategoryConfig
  categoryContextMenu?: ComponentType<CategoryContextMenuProps>
  tagNoteContextMenu?: ComponentType<TagNoteContextMenuProps>
  ancestorIds?: Array<Id<'notes'>>
}

interface TagNoteButtonProps {
  noteWithTag: Note
  categoryConfig: TagCategoryConfig
  contextMenuComponent?: ComponentType<TagNoteContextMenuProps>
  ancestorIds?: Array<Id<'notes'>>
}

export function TagNoteButton({
  noteWithTag,
  categoryConfig,
  contextMenuComponent,
  ancestorIds = [],
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
      <DraggableNote note={noteWithTag} ancestorIds={ancestorIds}>
        <SidebarItemButtonBase
          icon={FileText}
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

export const CategorySidebarItem = ({
  item,
  categoryConfig,
  categoryContextMenu,
  tagNoteContextMenu,
  ancestorIds = [],
}: CategorySidebarItemProps) => {
  // Handle notes - distinguish between folder-notes (no tagId) and tag-notes (has tagId)
  if (item.type === SIDEBAR_ITEM_TYPES.notes) {
    const note = item as Note
    // Notes with tagId are tag-notes, notes without tagId are folder-notes
    if (note.tagId) {
      return (
        <TagNoteButton
          noteWithTag={note}
          categoryConfig={categoryConfig}
          contextMenuComponent={tagNoteContextMenu}
          ancestorIds={ancestorIds}
        />
      )
    } else {
      return (
        <CategoryFolderButton
          folder={note}
          categoryConfig={categoryConfig}
          categoryContextMenu={categoryContextMenu}
          tagNoteContextMenu={tagNoteContextMenu}
          ancestorIds={ancestorIds}
        />
      )
    }
  }

  // Handle maps
  if (item.type === SIDEBAR_ITEM_TYPES.gameMaps) {
    return <MapButton map={item} ancestorIds={ancestorIds} />
  }

  // TypeScript should never reach here, but handle it just in case
  throw new Error(`Invalid item type: ${(item as any).type}`)
}
