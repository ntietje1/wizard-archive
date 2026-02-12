import { useCallback } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import {
  checkNameConflict,
  validateNoCircularParent,
  validateWikiLinkCompatibleName,
} from 'convex/sidebarItems/sharedValidation'
import { PERMISSION_LEVEL } from 'convex/shares/types'
import {
  usePendingCreateArgs,
  useSidebarItemsCollection,
} from './useSidebarItemsCollection'
import type {
  SIDEBAR_ITEM_TYPES,
  SidebarItemId,
} from 'convex/sidebarItems/baseTypes'
import type { ValidationResult } from 'convex/sidebarItems/sharedValidation'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomPartialBlock } from 'convex/notes/editorSpecs'
import { findUniqueSlugFromCollection } from '~/lib/slug'

interface CreateItemBase {
  campaignId: Id<'campaigns'>
  name?: string
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

export function useSidebarItemMutations() {
  const collection = useSidebarItemsCollection()
  const pendingCreateArgs = usePendingCreateArgs()

  const validateName = useCallback(
    (
      name: string | undefined,
      parentId: Id<'folders'> | undefined,
      excludeId?: SidebarItemId,
    ): ValidationResult => {
      if (!collection) return { valid: true }

      const wikiResult = validateWikiLinkCompatibleName(name)
      if (!wikiResult.valid) return wikiResult

      if (!name || name.trim() === '') return { valid: true }

      const allItems = Array.from(collection.state.values())
      const siblings = allItems.filter((i) => i.parentId === parentId)
      return checkNameConflict(name, siblings, excludeId)
    },
    [collection],
  )

  const canMoveToParent = useCallback(
    (
      itemId: SidebarItemId,
      newParentId: Id<'folders'> | undefined,
    ): boolean => {
      if (!collection) return true
      const allItems = Array.from(collection.state.values())
      const result = validateNoCircularParent(itemId, newParentId, (id) =>
        allItems.find((i) => i._id === id),
      )
      return result.valid
    },
    [collection],
  )

  const getSiblings = useCallback(
    (parentId: Id<'folders'> | undefined): Array<AnySidebarItem> => {
      if (!collection) return []
      const allItems = Array.from(collection.state.values())
      return allItems.filter((i) => i.parentId === parentId)
    },
    [collection],
  )

  const createItem = useCallback(
    (args: CreateItemArgs) => {
      if (!collection) return undefined

      // Validate name
      const nameResult = validateName(args.name, args.parentId)
      if (!nameResult.valid) {
        throw new Error(nameResult.error)
      }

      // Generate slug
      const slug = findUniqueSlugFromCollection(
        args.name,
        args.type,
        args.campaignId,
        collection.state,
      )

      // Generate temp ID
      const tempId = crypto.randomUUID() as unknown as SidebarItemId

      // Store full create args for onInsert handler
      pendingCreateArgs.current.set(tempId, args)

      // Build optimistic item
      const now = Date.now()
      const optimisticItem = {
        _id: tempId,
        _creationTime: now,
        name: args.name,
        slug,
        campaignId: args.campaignId,
        parentId: args.parentId,
        iconName: args.iconName,
        color: args.color,
        updatedAt: now,
        type: args.type,
        shares: [],
        isBookmarked: false,
        myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
        _optimistic: true,
      } as AnySidebarItem

      const tx = collection.insert(optimisticItem)
      return { tx, tempId, slug, optimisticItem }
    },
    [collection, validateName, pendingCreateArgs],
  )

  const rename = useCallback(
    (item: AnySidebarItem, newName: string) => {
      if (!collection) return undefined

      // Validate wiki-link compatibility
      const wikiResult = validateWikiLinkCompatibleName(newName)
      if (!wikiResult.valid) {
        throw new Error(wikiResult.error)
      }

      // Validate name conflict among siblings
      const allItems = Array.from(collection.state.values())
      const siblings = allItems.filter(
        (i) => i.parentId === item.parentId && i._id !== item._id,
      )
      const conflictResult = checkNameConflict(newName, siblings, item._id)
      if (!conflictResult.valid) {
        throw new Error(conflictResult.error)
      }

      // Predict the new slug
      const newSlug = findUniqueSlugFromCollection(
        newName,
        item.type,
        item.campaignId,
        collection.state,
        item._id,
      )

      // Apply optimistic update (name + slug)
      const tx = collection.update(item._id, (draft) => {
        draft.name = newName
        draft.slug = newSlug
      })

      return { tx, newSlug }
    },
    [collection],
  )

  const move = useCallback(
    (item: AnySidebarItem, newParentId: Id<'folders'> | undefined) => {
      if (!collection) return

      // Validate circular reference
      const allItems = Array.from(collection.state.values())
      const circularResult = validateNoCircularParent(
        item._id,
        newParentId,
        (id) => allItems.find((i) => i._id === id),
      )
      if (!circularResult.valid) {
        throw new Error(circularResult.error)
      }

      // Validate name conflict in target folder
      const siblings = allItems.filter(
        (i) => i.parentId === newParentId && i._id !== item._id,
      )
      const conflictResult = checkNameConflict(item.name, siblings, item._id)
      if (!conflictResult.valid) {
        throw new Error(conflictResult.error)
      }

      // Apply optimistic update
      return collection.update(item._id, (draft) => {
        draft.parentId = newParentId
      })
    },
    [collection],
  )

  const deleteItem = useCallback(
    (item: AnySidebarItem) => {
      if (!collection) return
      return collection.delete(item._id)
    },
    [collection],
  )

  const refetch = useCallback(async () => {
    if (!collection) return
    await collection.utils.refetch()
  }, [collection])

  return {
    createItem,
    rename,
    move,
    deleteItem,
    refetch,
    validateName,
    canMoveToParent,
    getSiblings,
    collection,
  }
}

/**
 * Live query hook for getting children of a folder from the collection.
 */
export function useCollectionChildren(parentId: Id<'folders'> | undefined) {
  const collection = useSidebarItemsCollection()

  return useLiveQuery(
    (q) => {
      if (!collection) return undefined
      return q
        .from({ item: collection })
        .fn.where((row) => row.item.parentId === parentId)
    },
    [collection, parentId],
  )
}
