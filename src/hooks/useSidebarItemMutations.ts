import { useCallback } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import {
  checkNameConflict,
  validateNoCircularParent,
  validateWikiLinkCompatibleName,
} from 'convex/sidebarItems/sharedValidation'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import { useSidebarItemsCollection } from '~/contexts/SidebarItemsCollectionContext'

export function useSidebarItemMutations() {
  const collection = useSidebarItemsCollection()

  const rename = useCallback(
    (item: AnySidebarItem, newName: string) => {
      if (!collection) return

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

      // Apply optimistic update
      return collection.update(item._id, (draft) => {
        draft.name = newName
      })
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
    rename,
    move,
    deleteItem,
    refetch,
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
