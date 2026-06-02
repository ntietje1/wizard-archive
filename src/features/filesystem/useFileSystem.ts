import { createContext, use } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemType } from 'shared/sidebar-items/types'
import type { SidebarItemColor } from 'shared/sidebar-items/color'
import type { SidebarItemIconName } from 'shared/sidebar-items/icon'
import type { SidebarItemName } from 'shared/sidebar-items/name'
import type { CreateParentTarget } from 'shared/sidebar-items/parent-target'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { FileSystemDropOptions } from 'shared/sidebar-items/filesystem/intent-planning'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { FileSystemGlobalDropTarget } from './filesystem-drop-planner'

// Public filesystem API. Callers describe user intent; this module owns command construction,
// conflict handling, optimistic patches, receipts, clipboard state, and undo/redo.
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

type CreateFileSystemItemInitializer = (created: CreatedFileSystemItem) => Promise<void> | void

type RenameFileSystemItemInput = {
  itemId: Id<'sidebarItems'>
  name?: SidebarItemName
  iconName?: SidebarItemIconName | null
  color?: SidebarItemColor | null
}

export type FileSystemDropIntent = {
  itemIds: Array<Id<'sidebarItems'>>
  target: FileSystemGlobalDropTarget
  options?: FileSystemDropOptions
}

type FileSystemPasteTargetInput = {
  clickedItem?: AnySidebarItem
  operationItems: Array<AnySidebarItem>
}

export type FileSystemValue = {
  createItem: (
    input: CreateFileSystemItemInput,
    initialize?: CreateFileSystemItemInitializer,
  ) => Promise<CreatedFileSystemItem | null>
  renameItem: (input: RenameFileSystemItemInput) => Promise<{ slug: SidebarItemSlug | null } | null>
  duplicateItems: (itemIds: Array<Id<'sidebarItems'>>) => Promise<void>
  requestTrashItems: (itemIds: Array<Id<'sidebarItems'>>) => Promise<void>
  restoreItems: (
    itemIds: Array<Id<'sidebarItems'>>,
    targetParentId?: Id<'sidebarItems'> | null,
  ) => Promise<void>
  confirmEmptyTrash: () => void
  confirmDeleteForever: (itemIds: Array<Id<'sidebarItems'>>) => void
  copy: (itemIds: Array<Id<'sidebarItems'>>) => void
  cut: (itemIds: Array<Id<'sidebarItems'>>) => void
  cancelClipboard: () => boolean
  canPaste: boolean
  canPasteIntoTarget: (input: FileSystemPasteTargetInput) => boolean
  pasteIntoTarget: (input: FileSystemPasteTargetInput) => Promise<void>
  paste: (targetParentId?: Id<'sidebarItems'> | null) => Promise<void>
  undo: () => Promise<void>
  redo: () => Promise<void>
  executeDrop: (intent: FileSystemDropIntent) => Promise<void>
  canUndo: boolean
  canRedo: boolean
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
