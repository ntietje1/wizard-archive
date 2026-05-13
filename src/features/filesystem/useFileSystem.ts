import { createContext, use } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarItemColor } from 'convex/sidebarItems/validation/color'
import type { SidebarItemIconName } from 'convex/sidebarItems/validation/icon'
import type { SidebarItemName } from 'convex/sidebarItems/validation/name'
import type { CreateParentTarget } from 'convex/sidebarItems/validation/parent'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { FileSystemDropOptions } from 'convex/sidebarItems/filesystem/intentPlanning'
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

export type FileSystemValue = {
  createItem: (input: CreateFileSystemItemInput) => Promise<CreatedFileSystemItem | null>
  renameItem: (input: RenameFileSystemItemInput) => Promise<{ slug: SidebarItemSlug | null } | null>
  duplicateItems: (
    itemIds: Array<Id<'sidebarItems'>>,
    targetParentId: Id<'sidebarItems'> | null,
  ) => Promise<void>
  requestTrashItems: (itemIds: Array<Id<'sidebarItems'>>) => Promise<boolean>
  restoreItems: (
    itemIds: Array<Id<'sidebarItems'>>,
    targetParentId?: Id<'sidebarItems'> | null,
  ) => Promise<void>
  emptyTrash: () => Promise<void>
  confirmDeleteForever: (itemIds: Array<Id<'sidebarItems'>>) => boolean
  copy: (itemIds: Array<Id<'sidebarItems'>>) => void
  cut: (itemIds: Array<Id<'sidebarItems'>>) => void
  cancelClipboard: () => boolean
  canPaste: boolean
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
