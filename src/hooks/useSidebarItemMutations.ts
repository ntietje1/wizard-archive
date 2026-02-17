import { createContext, useContext } from 'react'
import type {
  SIDEBAR_ITEM_TYPES as SIDEBAR_ITEM_TYPES_TYPE,
  SidebarItemId,
} from 'convex/sidebarItems/baseTypes'
import type { ValidationResult } from 'convex/sidebarItems/sharedValidation'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomPartialBlock } from 'convex/notes/editorSpecs'

interface CreateItemBase {
  campaignId: Id<'campaigns'>
  name?: string
  parentId?: Id<'folders'>
  iconName?: string
  color?: string
}

export type CreateNoteArgs = CreateItemBase & {
  type: typeof SIDEBAR_ITEM_TYPES_TYPE.notes
  content?: Array<CustomPartialBlock>
}

export type CreateFolderArgs = CreateItemBase & {
  type: typeof SIDEBAR_ITEM_TYPES_TYPE.folders
}

export type CreateMapArgs = CreateItemBase & {
  type: typeof SIDEBAR_ITEM_TYPES_TYPE.gameMaps
  imageStorageId?: Id<'_storage'>
}

export type CreateFileArgs = CreateItemBase & {
  type: typeof SIDEBAR_ITEM_TYPES_TYPE.files
  storageId?: Id<'_storage'>
}

export type CreateItemArgs =
  | CreateNoteArgs
  | CreateFolderArgs
  | CreateMapArgs
  | CreateFileArgs

export interface SidebarItemMutationsValue {
  createItem: (args: CreateItemArgs) => {
    tempId: SidebarItemId
    slug: string
    optimisticItem: AnySidebarItem
  }
  rename: (
    item: AnySidebarItem,
    newName: string,
  ) => { newSlug: string; promise: Promise<void> }
  move: (
    item: AnySidebarItem,
    newParentId: Id<'folders'> | undefined,
  ) => Promise<unknown>
  deleteItem: (item: AnySidebarItem) => Promise<void>
  validateName: (
    name: string | undefined,
    parentId: Id<'folders'> | undefined,
    excludeId?: SidebarItemId,
  ) => ValidationResult
  canMoveToParent: (
    itemId: SidebarItemId,
    newParentId: Id<'folders'> | undefined,
  ) => boolean
  getSiblings: (parentId: Id<'folders'> | undefined) => Array<AnySidebarItem>
}

export const SidebarItemMutationsContext =
  createContext<SidebarItemMutationsValue | null>(null)

export function useSidebarItemMutations(): SidebarItemMutationsValue {
  const ctx = useContext(SidebarItemMutationsContext)
  if (!ctx) {
    throw new Error(
      'useSidebarItemMutations must be used within a SidebarItemMutationsProvider',
    )
  }
  return ctx
}
