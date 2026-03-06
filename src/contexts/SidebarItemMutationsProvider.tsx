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
import { assertNever } from '~/lib/utils'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'
import { useCampaign } from '~/hooks/useCampaign'
import { SidebarItemMutationsContext } from '~/hooks/useSidebarItemMutations'

export function SidebarItemMutationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { itemsMap, parentItemsMap } = useAllSidebarItems()
  const { campaignId, campaign } = useCampaign()
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
  const permanentlyDeleteSidebarItemMutation = useConvexMutation(
    api.sidebarItems.mutations.permanentlyDeleteSidebarItem,
  )
  const emptyTrashBinMutation = useConvexMutation(
    api.sidebarItems.mutations.emptyTrashBin,
  )

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

  const trashedOptimisticUpdate = useCallback(
    (updater: (prev: Array<AnySidebarItem>) => Array<AnySidebarItem>) => {
      if (!campaignId) return
      queryClient.setQueryData<Array<AnySidebarItem>>(
        [
          'convexQuery',
          api.sidebarItems.queries.getTrashedSidebarItems,
          { campaignId },
        ],
        (prev) => (prev ? updater(prev) : prev),
      )
    },
    [campaignId, queryClient],
  )

  const getSiblings = useCallback(
    (parentId: Id<'folders'> | null) => {
      return parentItemsMap.get(parentId) ?? []
    },
    [parentItemsMap],
  )

  const validateName = useCallback(
    (
      name: string,
      parentId: Id<'folders'> | null,
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
    (itemId: SidebarItemId, newParentId: Id<'folders'> | null) => {
      return validateNoCircularParent(itemId, newParentId, (id) =>
        itemsMap.get(id),
      ).valid
    },
    [itemsMap],
  )

  const getDefaultName = useCallback(
    (type: SidebarItemType, parentId: Id<'folders'> | null) => {
      return findUniqueDefaultName(type, getSiblings(parentId))
    },
    [getSiblings],
  )

  // --- Mutations ---

  const createItem = useCallback(
    async (args: CreateItemArgs): Promise<CreateItemResult> => {
      const trimmedName = args.name.trim()
      const nameResult = validateName(trimmedName, args.parentId)
      if (!nameResult.valid) throw new Error(nameResult.error)

      switch (args.type) {
        case SIDEBAR_ITEM_TYPES.notes: {
          const { noteId, slug } = await createNoteMutation({
            campaignId: args.campaignId,
            name: trimmedName,
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
            name: trimmedName,
            parentId: args.parentId,
            iconName: args.iconName,
            color: args.color,
          })
          return { id: folderId, slug, type: args.type }
        }
        case SIDEBAR_ITEM_TYPES.gameMaps: {
          const { mapId, slug } = await createMapMutation({
            campaignId: args.campaignId,
            name: trimmedName,
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
            name: trimmedName,
            parentId: args.parentId,
            storageId: args.storageId,
            iconName: args.iconName,
            color: args.color,
          })
          return { id: fileId, slug, type: args.type }
        }
        default:
          return assertNever(args)
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
      const result = validateName(trimmedName, item.parentId, item._id)
      if (!result.valid) throw new Error(result.error)

      optimisticUpdate((prev) =>
        prev.map((i) => (i._id === item._id ? { ...i, name: trimmedName } : i)),
      )

      const promise = updateSidebarItemMutation({
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

  const moveItem = useCallback(
    (
      item: AnySidebarItem,
      options: { parentId?: Id<'folders'> | null; deleted?: boolean },
    ) => {
      const { parentId, deleted } = options
      const isTrashing = deleted === true && !item.deletionTime
      const isRestoring = deleted === false && !!item.deletionTime

      if (parentId !== undefined && !isTrashing && !isRestoring) {
        if (!canMoveToParent(item._id, parentId)) {
          throw new Error('Cannot move item: circular reference detected')
        }
        const nameResult = validateName(item.name, parentId, item._id)
        if (!nameResult.valid) throw new Error(nameResult.error)
      }

      // Optimistic update
      let undo: () => void = () => {}

      if (isRestoring) {
        trashedOptimisticUpdate((prev) =>
          prev.filter((i) => i._id !== item._id),
        )
        optimisticUpdate((prev) => [
          ...prev,
          {
            ...item,
            parentId: parentId ?? item.parentId ?? null,
            deletionTime: undefined,
            deletedBy: undefined,
          },
        ])
        undo = () => {
          optimisticUpdate((prev) => prev.filter((i) => i._id !== item._id))
          trashedOptimisticUpdate((prev) => [...prev, item])
        }
      } else if (isTrashing) {
        const deletedBy = campaign.data?.myMembership?.userId
        optimisticUpdate((prev) => prev.filter((i) => i._id !== item._id))
        trashedOptimisticUpdate((prev) => [
          {
            ...item,
            parentId: parentId ?? item.parentId ?? null,
            deletionTime: Date.now(),
            deletedBy,
          },
          ...prev,
        ])
        undo = () => {
          trashedOptimisticUpdate((prev) =>
            prev.filter((i) => i._id !== item._id),
          )
          optimisticUpdate((prev) => [...prev, item])
        }
      } else {
        const previousParentId = item.parentId
        const targetUpdate = item.deletionTime
          ? trashedOptimisticUpdate
          : optimisticUpdate
        targetUpdate((prev) =>
          prev.map((i) =>
            i._id === item._id ? { ...i, parentId: parentId ?? null } : i,
          ),
        )
        undo = () => {
          targetUpdate((prev) =>
            prev.map((i) =>
              i._id === item._id ? { ...i, parentId: previousParentId } : i,
            ),
          )
        }
      }

      const mutation = moveSidebarItemMutation({
        itemId: item._id,
        parentId,
        deleted,
      })

      mutation.catch(() => undo())

      return mutation
    },
    [
      campaign.data?.myMembership?.userId,
      canMoveToParent,
      validateName,
      optimisticUpdate,
      trashedOptimisticUpdate,
      moveSidebarItemMutation,
    ],
  )

  const permanentlyDeleteItem = useCallback(
    (item: AnySidebarItem) => {
      trashedOptimisticUpdate((prev) => prev.filter((i) => i._id !== item._id))

      const mutation = permanentlyDeleteSidebarItemMutation({
        itemId: item._id,
      })

      mutation.catch(() => {
        trashedOptimisticUpdate((prev) => [...prev, item])
      })

      return mutation.then(() => {})
    },
    [permanentlyDeleteSidebarItemMutation, trashedOptimisticUpdate],
  )

  const emptyTrashBin = useCallback(() => {
    if (!campaignId) return Promise.resolve()

    const previousItems = queryClient.getQueryData<Array<AnySidebarItem>>([
      'convexQuery',
      api.sidebarItems.queries.getTrashedSidebarItems,
      { campaignId },
    ])

    trashedOptimisticUpdate(() => [])

    const mutation = emptyTrashBinMutation({ campaignId })

    mutation.catch(() => {
      if (previousItems) {
        trashedOptimisticUpdate(() => previousItems)
      }
    })

    return mutation.then(() => {})
  }, [campaignId, queryClient, trashedOptimisticUpdate, emptyTrashBinMutation])

  const value: SidebarItemMutationsValue = useMemo(
    () => ({
      createItem,
      getDefaultName,
      rename,
      moveItem,
      permanentlyDeleteItem,
      emptyTrashBin,
      validateName,
      canMoveToParent,
      getSiblings,
    }),
    [
      createItem,
      getDefaultName,
      rename,
      moveItem,
      permanentlyDeleteItem,
      emptyTrashBin,
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
