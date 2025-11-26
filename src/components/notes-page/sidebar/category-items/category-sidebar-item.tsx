import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useCurrentNote } from '~/hooks/useCurrentNote'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useMemo } from 'react'
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
  type SidebarItemType,
} from 'convex/sidebarItems/types'
import {
  UNTITLED_NOTE_TITLE,
  type Note,
} from 'convex/notes/types'
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
  ancestorIds?: Array<Id<'folders'>>
}

interface TagNoteButtonProps {
  noteWithTag: Note
  categoryConfig: TagCategoryConfig
  contextMenuComponent?: ComponentType<TagNoteContextMenuProps>
  ancestorIds?: Array<Id<'folders'>>
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
  const CATEGORY_SIDEBAR_ITEM_REGISTRY = useMemo<
    Record<SidebarItemType, ComponentType<any>>
  >(
    () => ({
      [SIDEBAR_ITEM_TYPES.folders]: CategoryFolderButton,
      [SIDEBAR_ITEM_TYPES.notes]: TagNoteButton,
      [SIDEBAR_ITEM_TYPES.gameMaps]: MapButton,
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

  if (item.type === SIDEBAR_ITEM_TYPES.gameMaps) {
    return <Component map={item} ancestorIds={ancestorIds} />
  }

  throw new Error('Invalid item type or missing required properties')
}
