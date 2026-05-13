import { createContext, use } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarItemColor } from 'convex/sidebarItems/validation/color'
import type { SidebarItemIconName } from 'convex/sidebarItems/validation/icon'
import type { SidebarItemName } from 'convex/sidebarItems/validation/name'
import type { CreateParentTarget } from 'convex/sidebarItems/validation/parent'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { FileSystemGlobalDropCommand } from './filesystem-drop-planner'

type CreateFileSystemItemInput = {
  itemType: SidebarItemType
  name: SidebarItemName
  parentTarget: CreateParentTarget
  iconName?: SidebarItemIconName
  color?: SidebarItemColor
}

type CreatedFileSystemItem = {
  id: Id<'sidebarItems'>
  slug: SidebarItemSlug
}

type RenameFileSystemItemInput = {
  itemId: Id<'sidebarItems'>
  name?: SidebarItemName
  iconName?: SidebarItemIconName | null
  color?: SidebarItemColor | null
}

export type FileSystemValue = {
  createItem: (input: CreateFileSystemItemInput) => Promise<CreatedFileSystemItem | null>
  renameItem: (input: RenameFileSystemItemInput) => Promise<{ slug: SidebarItemSlug | null } | null>
  moveItems: (
    itemIds: Array<Id<'sidebarItems'>>,
    targetParentId: Id<'sidebarItems'> | null,
  ) => Promise<void>
  copyItems: (
    itemIds: Array<Id<'sidebarItems'>>,
    targetParentId: Id<'sidebarItems'> | null,
  ) => Promise<void>
  trashItems: (itemIds: Array<Id<'sidebarItems'>>) => Promise<void>
  restoreItems: (
    itemIds: Array<Id<'sidebarItems'>>,
    targetParentId?: Id<'sidebarItems'> | null,
  ) => Promise<void>
  deleteForever: (itemIds: Array<Id<'sidebarItems'>>) => Promise<void>
  emptyTrash: () => Promise<void>
  confirmDeleteForever: (itemIds: Array<Id<'sidebarItems'>>) => boolean
  copy: (itemIds: Array<Id<'sidebarItems'>>) => void
  cut: (itemIds: Array<Id<'sidebarItems'>>) => void
  cancelClipboard: () => boolean
  canPaste: boolean
  /**
   * @param targetParentId Omit for the active surface default, pass null for root, or pass an id for a folder.
   * @returns A promise that resolves when paste handling finishes.
   */
  paste: (targetParentId?: Id<'sidebarItems'> | null) => Promise<void>
  undo: () => Promise<void>
  redo: () => Promise<void>
  executeDropCommand: (command: FileSystemGlobalDropCommand) => Promise<void>
  canUndo: boolean
  canRedo: boolean
  resolveOperationItems: (items: Array<AnySidebarItem>) => Array<AnySidebarItem>
  resolveContextItems: (context: {
    item?: AnySidebarItem
    primaryItem?: AnySidebarItem
    selectedItems?: Array<AnySidebarItem>
  }) => Array<AnySidebarItem>
}

export const FileSystemContext = createContext<FileSystemValue | null>(null)
FileSystemContext.displayName = 'FileSystemContext'

export function useFileSystem() {
  const value = use(FileSystemContext)
  if (!value) {
    throw new Error('useFileSystem must be used inside FileSystemProvider')
  }
  return value
}
