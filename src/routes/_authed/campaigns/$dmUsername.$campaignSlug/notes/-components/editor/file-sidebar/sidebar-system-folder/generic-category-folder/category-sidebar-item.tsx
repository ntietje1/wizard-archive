import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useCurrentNote } from '~/hooks/useCurrentNote'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useMemo } from 'react'
import type { ComponentType } from 'react'
import {
  TagNoteContextMenu,
  type TagNoteContextMenuProps,
} from './tag-note-context.menu'
import { SidebarItemButtonBase } from '../../sidebar-item/sidebar-item-button-base'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import {
  SIDEBAR_ITEM_TYPES,
  UNTITLED_NOTE_TITLE,
  type AnySidebarItem,
  type Note,
  type SidebarItemType,
} from 'convex/notes/types'
import { CategoryFolderButton } from './category-folder-button'
import type { CategoryContextMenuProps } from './category-context-menu'
import { DraggableNote } from '../../sidebar-note/draggable-note'
import { FileEdit, FileText } from '~/lib/icons'
import { useContextMenu } from '~/hooks/useContextMenu'
import { MapButton } from '../../sidebar-map/map-button'
import type { Id } from 'convex/_generated/dataModel'

interface CategorySidebarItemProps {
  item: AnySidebarItem
  categoryConfig: TagCategoryConfig
  categoryContextMenu?: ComponentType<CategoryContextMenuProps>
  tagNoteContextMenu?: ComponentType<TagNoteContextMenuProps>
  ancestorIds?: Id<'folders'>[]
}

interface TagNoteButtonProps {
  noteWithTag: Note
  categoryConfig: TagCategoryConfig
  contextMenuComponent?: ComponentType<TagNoteContextMenuProps>
  ancestorIds?: Id<'folders'>[]
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

export const CategorySidebarItem = ({
  item,
  categoryConfig,
  categoryContextMenu,
  tagNoteContextMenu,
  ancestorIds = [],
}: CategorySidebarItemProps) => {
  const CATEGORY_SIDEBAR_ITEM_REGISTRY = useMemo<
    Record<SidebarItemType, ComponentType<any>>
  >(
    () => ({
      [SIDEBAR_ITEM_TYPES.folders]: CategoryFolderButton,
      [SIDEBAR_ITEM_TYPES.notes]: TagNoteButton,
      [SIDEBAR_ITEM_TYPES.maps]: MapButton,
    }),
    [],
  )

  const Component = CATEGORY_SIDEBAR_ITEM_REGISTRY[item.type]

  if (!Component) {
    throw new Error(`Invalid item type: ${item.type}`)
  }

  if (item.type === SIDEBAR_ITEM_TYPES.folders) {
    return (
      <Component
        folder={item}
        categoryConfig={categoryConfig}
        categoryContextMenu={categoryContextMenu}
        tagNoteContextMenu={tagNoteContextMenu}
        ancestorIds={ancestorIds}
      />
    )
  }

  if (item.type === SIDEBAR_ITEM_TYPES.notes) {
    return (
      <Component
        noteWithTag={item}
        categoryConfig={categoryConfig}
        contextMenuComponent={tagNoteContextMenu}
        ancestorIds={ancestorIds}
      />
    )
  }

  if (item.type === SIDEBAR_ITEM_TYPES.maps) {
    return <Component map={item} ancestorIds={ancestorIds} />
  }

  throw new Error('Invalid item type or missing required properties')
}
