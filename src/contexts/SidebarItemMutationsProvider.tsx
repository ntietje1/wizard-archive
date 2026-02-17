import { useQueryClient } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import {
  checkNameConflict,
  validateNoCircularParent,
  validateWikiLinkCompatibleName,
} from 'convex/sidebarItems/sharedValidation'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/baseTypes'
import { PERMISSION_LEVEL } from 'convex/shares/types'
import type { SidebarItemId } from 'convex/sidebarItems/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import type {
  CreateItemArgs,
  SidebarItemMutationsValue,
} from '~/hooks/useSidebarItemMutations'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'
import { useCampaign } from '~/hooks/useCampaign'
import { findUniqueSlugFromCollection } from '~/lib/slug'
import { SidebarItemMutationsContext } from '~/hooks/useSidebarItemMutations'

export function SidebarItemMutationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { itemsMap } = useAllSidebarItems()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const queryClient = useQueryClient()

  // Convex mutations
  const createNoteMutation = useConvexMutation(api.notes.mutations.createNote)
  const createFolderMutation = useConvexMutation(
    api.folders.mutations.createFolder,
  )
  const createMapMutation = useConvexMutation(api.gameMaps.mutations.createMap)
  const createFileMutation = useConvexMutation(api.files.mutations.createFile)
  const updateSidebarItemMutation = useConvexMutation(
    api.sidebarItems.mutations.updateSidebarItem,
  )
  const moveNoteMutation = useConvexMutation(api.notes.mutations.moveNote)
  const moveFolderMutation = useConvexMutation(api.folders.mutations.moveFolder)
  const moveMapMutation = useConvexMutation(api.gameMaps.mutations.moveMap)
  const moveFileMutation = useConvexMutation(api.files.mutations.moveFile)
  const deleteNoteMutation = useConvexMutation(api.notes.mutations.deleteNote)
  const deleteFolderMutation = useConvexMutation(
    api.folders.mutations.deleteFolder,
  )
  const deleteMapMutation = useConvexMutation(api.gameMaps.mutations.deleteMap)
  const deleteFileMutation = useConvexMutation(api.files.mutations.deleteFile)

  // --- Helpers ---

  const optimisticUpdate = (
    updater: (prev: Array<AnySidebarItem>) => Array<AnySidebarItem>,
  ) => {
    if (!campaignId) return
    queryClient.setQueryData<Array<AnySidebarItem>>(
      [
        convexQuery,
        api.sidebarItems.queries.getAllSidebarItems,
        { campaignId },
      ],
      (prev) => (prev ? updater(prev) : prev),
    )
  }

  const getSiblings = (parentId: Id<'folders'> | undefined) => {
    const allItems = Array.from(itemsMap.values())
    return allItems.filter((i) => i.parentId === parentId)
  }

  const validateName = (
    name: string | undefined,
    parentId: Id<'folders'> | undefined,
    excludeId?: SidebarItemId,
  ) => {
    const wikiResult = validateWikiLinkCompatibleName(name)
    if (!wikiResult.valid) return wikiResult
    if (!name || name.trim() === '') return { valid: true as const }
    return checkNameConflict(name, getSiblings(parentId), excludeId)
  }

  const canMoveToParent = (
    itemId: SidebarItemId,
    newParentId: Id<'folders'> | undefined,
  ) => {
    const allItems = Array.from(itemsMap.values())
    return validateNoCircularParent(itemId, newParentId, (id) =>
      allItems.find((i) => i._id === id),
    ).valid
  }

  // --- Mutations ---

  const createItem = (args: CreateItemArgs) => {
    const nameResult = validateName(args.name, args.parentId)
    if (!nameResult.valid) throw new Error(nameResult.error)

    const slug = findUniqueSlugFromCollection(
      args.name,
      args.type,
      args.campaignId,
      itemsMap,
    )
    const tempId = crypto.randomUUID() as unknown as SidebarItemId
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

    optimisticUpdate((prev) => [...prev, optimisticItem])

    const mutationPromise = (() => {
      switch (args.type) {
        case SIDEBAR_ITEM_TYPES.notes:
          return createNoteMutation({
            campaignId: args.campaignId,
            name: args.name,
            parentId: args.parentId,
            iconName: args.iconName,
            color: args.color,
            content: args.content,
            slug,
          })
        case SIDEBAR_ITEM_TYPES.folders:
          return createFolderMutation({
            campaignId: args.campaignId,
            name: args.name,
            parentId: args.parentId,
            slug,
            iconName: args.iconName,
            color: args.color,
          })
        case SIDEBAR_ITEM_TYPES.gameMaps:
          return createMapMutation({
            campaignId: args.campaignId,
            name: args.name,
            parentId: args.parentId,
            imageStorageId: args.imageStorageId,
            slug,
            iconName: args.iconName,
            color: args.color,
          })
        case SIDEBAR_ITEM_TYPES.files:
          return createFileMutation({
            campaignId: args.campaignId,
            name: args.name,
            parentId: args.parentId,
            storageId: args.storageId,
            slug,
            iconName: args.iconName,
            color: args.color,
          })
      }
    })()

    mutationPromise.catch(() => {
      optimisticUpdate((prev) => prev.filter((item) => item._id !== tempId))
    })

    return { tempId, slug, optimisticItem }
  }

  const rename = (item: AnySidebarItem, newName: string) => {
    const result = validateName(newName, item.parentId, item._id)
    if (!result.valid) throw new Error(result.error)

    const newSlug = findUniqueSlugFromCollection(
      newName,
      item.type,
      item.campaignId,
      itemsMap,
      item._id,
    )

    optimisticUpdate((prev) =>
      prev.map((i) =>
        i._id === item._id ? { ...i, name: newName, slug: newSlug } : i,
      ),
    )

    const promise = updateSidebarItemMutation({
      itemId: item._id,
      name: newName,
      slug: newSlug,
    }).then(
      () => {},
      () => {
        optimisticUpdate((prev) =>
          prev.map((i) =>
            i._id === item._id ? { ...i, name: item.name, slug: item.slug } : i,
          ),
        )
      },
    )

    return { newSlug, promise }
  }

  const move = (
    item: AnySidebarItem,
    newParentId: Id<'folders'> | undefined,
  ) => {
    if (!canMoveToParent(item._id, newParentId)) {
      throw new Error('Cannot move item: circular reference detected')
    }

    const nameResult = validateName(item.name, newParentId, item._id)
    if (!nameResult.valid) throw new Error(nameResult.error)

    const previousParentId = item.parentId

    optimisticUpdate((prev) =>
      prev.map((i) =>
        i._id === item._id ? { ...i, parentId: newParentId } : i,
      ),
    )

    const moveMutation = (() => {
      switch (item.type) {
        case SIDEBAR_ITEM_TYPES.notes:
          return moveNoteMutation({ noteId: item._id, parentId: newParentId })
        case SIDEBAR_ITEM_TYPES.folders:
          return moveFolderMutation({
            folderId: item._id,
            parentId: newParentId,
          })
        case SIDEBAR_ITEM_TYPES.gameMaps:
          return moveMapMutation({ mapId: item._id, parentId: newParentId })
        case SIDEBAR_ITEM_TYPES.files:
          return moveFileMutation({ fileId: item._id, parentId: newParentId })
      }
    })()

    moveMutation.catch(() => {
      optimisticUpdate((prev) =>
        prev.map((i) =>
          i._id === item._id ? { ...i, parentId: previousParentId } : i,
        ),
      )
    })

    return moveMutation
  }

  const deleteItem = async (item: AnySidebarItem) => {
    optimisticUpdate((prev) => prev.filter((i) => i._id !== item._id))

    try {
      switch (item.type) {
        case SIDEBAR_ITEM_TYPES.notes:
          await deleteNoteMutation({ noteId: item._id })
          break
        case SIDEBAR_ITEM_TYPES.folders:
          await deleteFolderMutation({ folderId: item._id })
          break
        case SIDEBAR_ITEM_TYPES.gameMaps:
          await deleteMapMutation({ mapId: item._id })
          break
        case SIDEBAR_ITEM_TYPES.files:
          await deleteFileMutation({ fileId: item._id })
          break
      }
    } catch {
      optimisticUpdate((prev) => [...prev, item])
      throw new Error('Failed to delete item')
    }
  }

  return (
    <SidebarItemMutationsContext.Provider
      value={{
        createItem,
        rename,
        move,
        deleteItem,
        validateName,
        canMoveToParent,
        getSiblings,
      }}
    >
      {children}
    </SidebarItemMutationsContext.Provider>
  )
}
