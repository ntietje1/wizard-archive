import { createContext, useContext } from 'react'
import type {
  SIDEBAR_ITEM_TYPES,
  SidebarItemId,
  SidebarItemType,
} from 'convex/sidebarItems/types/baseTypes'
import type { ValidationResult } from 'convex/sidebarItems/sharedValidation'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomPartialBlock } from 'convex/notes/editorSpecs'

interface CreateItemBase {
  campaignId: Id<'campaigns'>
  name: string
  parentId?: Id<'folders'>
  iconName?: string
  color?: string
}

export type CreateNoteArgs = CreateItemBase & {
  type: typeof SIDEBAR_ITEM_TYPES.notes
  content?: Array<CustomPartialBlock>
}

export type CreateFolderArgs = CreateItemBase & {
  type: typeof SIDEBAR_ITEM_TYPES.folders
}

export type CreateMapArgs = CreateItemBase & {
  type: typeof SIDEBAR_ITEM_TYPES.gameMaps
  imageStorageId?: Id<'_storage'>
}

export type CreateFileArgs = CreateItemBase & {
  type: typeof SIDEBAR_ITEM_TYPES.files
  storageId?: Id<'_storage'>
}

export type CreateItemArgs =
  | CreateNoteArgs
  | CreateFolderArgs
  | CreateMapArgs
  | CreateFileArgs

export type CreateItemResult = {
  id: SidebarItemId
  slug: string
  type: SidebarItemType
}

export interface SidebarItemMutationsValue {
  createItem: (args: CreateItemArgs) => Promise<CreateItemResult>
  getDefaultName: (type: SidebarItemType, parentId?: Id<'folders'>) => string
  rename: (
    item: AnySidebarItem,
    newName: string,
  ) => { promise: Promise<{ slug: string } | void> }
  moveItem: (
    item: AnySidebarItem,
    options: { parentId?: Id<'folders'>; deleted?: boolean },
  ) => Promise<unknown>
  permanentlyDeleteItem: (item: AnySidebarItem) => Promise<void>
  emptyTrashBin: () => Promise<void>
  validateName: (
    name: string,
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
