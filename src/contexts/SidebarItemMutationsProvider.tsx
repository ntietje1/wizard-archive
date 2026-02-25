import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import {
  checkNameConflict,
  validateItemName,
  validateNoCircularParent,
} from 'convex/sidebarItems/sharedValidation'
import { findUniqueDefaultName } from 'convex/sidebarItems/functions/defaultItemName'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type {
  SidebarItemId,
  SidebarItemType,
} from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import type {
  CreateItemArgs,
  CreateItemResult,
  SidebarItemMutationsValue,
} from '~/hooks/useSidebarItemMutations'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'
import { useCampaign } from '~/hooks/useCampaign'
import { SidebarItemMutationsContext } from '~/hooks/useSidebarItemMutations'

export function SidebarItemMutationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { itemsMap, parentItemsMap } = useAllSidebarItems()
  const { campaignId } = useCampaign()
  const queryClient = useQueryClient()

  const createNoteMutation = useConvexMutation(api.notes.mutations.createNote)
  const createFolderMutation = useConvexMutation(
    api.folders.mutations.createFolder,
  )
  const createMapMutation = useConvexMutation(api.gameMaps.mutations.createMap)
  const createFileMutation = useConvexMutation(api.files.mutations.createFile)
  const updateSidebarItemMutation = useConvexMutation(
    api.sidebarItems.mutations.updateSidebarItem,
  )
  const moveSidebarItemMutation = useConvexMutation(
    api.sidebarItems.mutations.moveSidebarItem,
  )
  const deleteNoteMutation = useConvexMutation(api.notes.mutations.deleteNote)
  const deleteFolderMutation = useConvexMutation(
    api.folders.mutations.deleteFolder,
  )
  const deleteMapMutation = useConvexMutation(api.gameMaps.mutations.deleteMap)
  const deleteFileMutation = useConvexMutation(api.files.mutations.deleteFile)

  // --- Helpers ---

  const optimisticUpdate = useCallback(
    (updater: (prev: Array<AnySidebarItem>) => Array<AnySidebarItem>) => {
      if (!campaignId) return
      queryClient.setQueryData<Array<AnySidebarItem>>(
        [
          'convexQuery',
          api.sidebarItems.queries.getAllSidebarItems,
          { campaignId },
        ],
        (prev) => (prev ? updater(prev) : prev),
      )
    },
    [campaignId, queryClient],
  )

  const getSiblings = useCallback(
    (parentId: Id<'folders'> | undefined) => {
      return parentItemsMap.get(parentId) ?? []
    },
    [parentItemsMap],
  )

  const validateName = useCallback(
    (
      name: string,
      parentId: Id<'folders'> | undefined,
      excludeId?: SidebarItemId,
    ) => {
      const trimmed = name.trim()
      const nameResult = validateItemName(trimmed)
      if (!nameResult.valid) return nameResult
      return checkNameConflict(trimmed, getSiblings(parentId), excludeId)
    },
    [getSiblings],
  )

  const canMoveToParent = useCallback(
    (itemId: SidebarItemId, newParentId: Id<'folders'> | undefined) => {
      return validateNoCircularParent(itemId, newParentId, (id) =>
        itemsMap.get(id),
      ).valid
    },
    [itemsMap],
  )

  const getDefaultName = useCallback(
    (type: SidebarItemType, parentId?: Id<'folders'>) => {
      return findUniqueDefaultName(type, getSiblings(parentId))
    },
    [getSiblings],
  )

  // --- Mutations ---

  const createItem = useCallback(
    async (args: CreateItemArgs): Promise<CreateItemResult> => {
      const resolvedName = args.name.trim()
      if (!resolvedName) throw new Error('Name is required')

      const nameResult = validateName(resolvedName, args.parentId ?? undefined)
      if (!nameResult.valid) throw new Error(nameResult.error)

      switch (args.type) {
        case SIDEBAR_ITEM_TYPES.notes: {
          const { noteId, slug } = await createNoteMutation({
            campaignId: args.campaignId,
            name: resolvedName,
            parentId: args.parentId,
            iconName: args.iconName,
            color: args.color,
            content: args.content,
          })
          return { id: noteId, slug, type: args.type }
        }
        case SIDEBAR_ITEM_TYPES.folders: {
          const { folderId, slug } = await createFolderMutation({
            campaignId: args.campaignId,
            name: resolvedName,
            parentId: args.parentId,
            iconName: args.iconName,
            color: args.color,
          })
          return { id: folderId, slug, type: args.type }
        }
        case SIDEBAR_ITEM_TYPES.gameMaps: {
          const { mapId, slug } = await createMapMutation({
            campaignId: args.campaignId,
            name: resolvedName,
            parentId: args.parentId,
            imageStorageId: args.imageStorageId,
            iconName: args.iconName,
            color: args.color,
          })
          return { id: mapId, slug, type: args.type }
        }
        case SIDEBAR_ITEM_TYPES.files: {
          const { fileId, slug } = await createFileMutation({
            campaignId: args.campaignId,
            name: resolvedName,
            parentId: args.parentId,
            storageId: args.storageId,
            iconName: args.iconName,
            color: args.color,
          })
          return { id: fileId, slug, type: args.type }
        }
        default: {
          throw new Error(`Unsupported sidebar item type`)
        }
      }
    },
    [
      validateName,
      createNoteMutation,
      createFolderMutation,
      createMapMutation,
      createFileMutation,
    ],
  )

  const rename = useCallback(
    (item: AnySidebarItem, newName: string) => {
      const trimmedName = newName.trim()
      const result = validateName(trimmedName, item.parentId ?? undefined, item._id)
      if (!result.valid) throw new Error(result.error)

      optimisticUpdate((prev) =>
        prev.map((i) => (i._id === item._id ? { ...i, name: trimmedName } : i)),
      )

      const promise = updateSidebarItemMutation({
        campaignId: item.campaignId,
        itemId: item._id,
        name: trimmedName,
      }).then(
        (res) => {
          if (res?.slug) {
            optimisticUpdate((prev) =>
              prev.map((i) =>
                i._id === item._id ? { ...i, slug: res.slug } : i,
              ),
            )
          }
          return res
        },
        () => {
          optimisticUpdate((prev) =>
            prev.map((i) =>
              i._id === item._id
                ? { ...i, name: item.name, slug: item.slug }
                : i,
            ),
          )
        },
      )

      return { promise }
    },
    [validateName, optimisticUpdate, updateSidebarItemMutation],
  )

  const move = useCallback(
    (item: AnySidebarItem, newParentId: Id<'folders'> | undefined) => {
      if (!canMoveToParent(item._id, newParentId)) {
        throw new Error('Cannot move item: circular reference detected')
      }

      const nameResult = validateName(item.name, newParentId, item._id)
      if (!nameResult.valid) throw new Error(nameResult.error)

      const previousParentId = item.parentId

      optimisticUpdate((prev) =>
        prev.map((i) =>
          i._id === item._id ? { ...i, parentId: newParentId ?? null } : i,
        ),
      )

      const moveMutation = moveSidebarItemMutation({
        campaignId: item.campaignId,
        itemId: item._id,
        parentId: newParentId,
      })

      moveMutation.catch(() => {
        optimisticUpdate((prev) =>
          prev.map((i) =>
            i._id === item._id ? { ...i, parentId: previousParentId } : i,
          ),
        )
      })

      return moveMutation
    },
    [
      canMoveToParent,
      validateName,
      optimisticUpdate,
      moveSidebarItemMutation,
    ],
  )

  const deleteItem = useCallback(
    async (item: AnySidebarItem) => {
      optimisticUpdate((prev) => prev.filter((i) => i._id !== item._id))

      try {
        switch (item.type) {
          case SIDEBAR_ITEM_TYPES.notes:
            await deleteNoteMutation({
              campaignId: item.campaignId,
              noteId: item._id,
            })
            break
          case SIDEBAR_ITEM_TYPES.folders:
            await deleteFolderMutation({
              campaignId: item.campaignId,
              folderId: item._id,
            })
            break
          case SIDEBAR_ITEM_TYPES.gameMaps:
            await deleteMapMutation({
              campaignId: item.campaignId,
              mapId: item._id,
            })
            break
          case SIDEBAR_ITEM_TYPES.files:
            await deleteFileMutation({
              campaignId: item.campaignId,
              fileId: item._id,
            })
            break
        }
      } catch {
        optimisticUpdate((prev) => [...prev, item])
        throw new Error('Failed to delete item')
      }
    },
    [
      optimisticUpdate,
      deleteNoteMutation,
      deleteFolderMutation,
      deleteMapMutation,
      deleteFileMutation,
    ],
  )

  const value: SidebarItemMutationsValue = useMemo(
    () => ({
      createItem,
      getDefaultName,
      rename,
      move,
      deleteItem,
      validateName,
      canMoveToParent,
      getSiblings,
    }),
    [
      createItem,
      getDefaultName,
      rename,
      move,
      deleteItem,
      validateName,
      canMoveToParent,
      getSiblings,
    ],
  )

  return (
    <SidebarItemMutationsContext.Provider value={value}>
      {children}
    </SidebarItemMutationsContext.Provider>
  )
}
