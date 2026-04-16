import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { logger } from '~/shared/utils/logger'
import { assertNever } from '~/shared/utils/utils'

interface CreateItemBase {
  campaignId: Id<'campaigns'>
  name: string
  parentId: Id<'sidebarItems'> | null
  parentPath?: Array<string>
  iconName?: string
  color?: string
}

type CreateNoteArgs = CreateItemBase & {
  type: typeof SIDEBAR_ITEM_TYPES.notes
  content?: Array<CustomBlock>
}

type CreateFolderArgs = CreateItemBase & {
  type: typeof SIDEBAR_ITEM_TYPES.folders
}

type CreateMapArgs = CreateItemBase & {
  type: typeof SIDEBAR_ITEM_TYPES.gameMaps
  imageStorageId?: Id<'_storage'>
}

type CreateFileArgs = CreateItemBase & {
  type: typeof SIDEBAR_ITEM_TYPES.files
  storageId?: Id<'_storage'>
}

type CreateCanvasArgs = CreateItemBase & {
  type: typeof SIDEBAR_ITEM_TYPES.canvases
}

export type CreateItemArgs =
  | CreateNoteArgs
  | CreateFolderArgs
  | CreateMapArgs
  | CreateFileArgs
  | CreateCanvasArgs

export type CreateItemResult = {
  id: Id<'sidebarItems'>
  slug: string
  type: SidebarItemType
}

function findSiblingByName(
  siblings: Array<AnySidebarItem>,
  name: string,
): AnySidebarItem | undefined {
  const normalizedName = name.trim().toLowerCase()
  return siblings.find((item) => item.name.trim().toLowerCase() === normalizedName)
}

export function useCreateSidebarItem() {
  const { parentItemsMap } = useActiveSidebarItems()
  const validation = useSidebarValidation()
  const createNoteMutation = useAppMutation(api.notes.mutations.createNote)
  const createFolderMutation = useAppMutation(api.folders.mutations.createFolder)
  const createMapMutation = useAppMutation(api.gameMaps.mutations.createMap)
  const createFileMutation = useAppMutation(api.files.mutations.createFile)
  const createCanvasMutation = useAppMutation(api.canvases.mutations.createCanvas)
  const moveSidebarItemMutation = useAppMutation(api.sidebarItems.mutations.moveSidebarItem)
  const permanentlyDeleteSidebarItemMutation = useAppMutation(
    api.sidebarItems.mutations.permanentlyDeleteSidebarItem,
  )

  const createItem = async (args: CreateItemArgs): Promise<CreateItemResult> => {
    const trimmedName = args.name.trim()
    let resolvedParentId = args.parentId
    let createdRootFolderId: Id<'sidebarItems'> | null = null

    const rollbackCreatedFolders = async () => {
      if (!createdRootFolderId) return

      await moveSidebarItemMutation.mutateAsync({
        campaignId: args.campaignId,
        itemId: createdRootFolderId,
        location: SIDEBAR_ITEM_LOCATION.trash,
      })
      await permanentlyDeleteSidebarItemMutation.mutateAsync({
        campaignId: args.campaignId,
        itemId: createdRootFolderId,
      })
    }

    try {
      for (const segment of args.parentPath ?? []) {
        const trimmedSegment = segment.trim()
        const siblings = parentItemsMap.get(resolvedParentId) ?? []
        const existing = findSiblingByName(siblings, trimmedSegment)
        if (existing) {
          if (existing.type !== SIDEBAR_ITEM_TYPES.folders) {
            throw new Error(`"${trimmedSegment}" already exists here and is not a folder`)
          }
          resolvedParentId = existing._id
          continue
        }

        const nameResult = validation.validateName(trimmedSegment, resolvedParentId)
        if (!nameResult.valid) throw new Error(nameResult.error)

        const { folderId } = await createFolderMutation.mutateAsync({
          campaignId: args.campaignId,
          name: trimmedSegment,
          parentId: resolvedParentId,
        })
        createdRootFolderId ??= folderId
        resolvedParentId = folderId
      }

      const nameResult = validation.validateName(trimmedName, resolvedParentId)
      if (!nameResult.valid) throw new Error(nameResult.error)

      switch (args.type) {
        case SIDEBAR_ITEM_TYPES.notes: {
          const { noteId, slug } = await createNoteMutation.mutateAsync({
            campaignId: args.campaignId,
            name: trimmedName,
            parentId: resolvedParentId,
            iconName: args.iconName,
            color: args.color,
            content: args.content,
          })
          return { id: noteId, slug, type: args.type }
        }
        case SIDEBAR_ITEM_TYPES.folders: {
          const { folderId, slug } = await createFolderMutation.mutateAsync({
            campaignId: args.campaignId,
            name: trimmedName,
            parentId: resolvedParentId,
            iconName: args.iconName,
            color: args.color,
          })
          return { id: folderId, slug, type: args.type }
        }
        case SIDEBAR_ITEM_TYPES.gameMaps: {
          const { mapId, slug } = await createMapMutation.mutateAsync({
            campaignId: args.campaignId,
            name: trimmedName,
            parentId: resolvedParentId,
            imageStorageId: args.imageStorageId,
            iconName: args.iconName,
            color: args.color,
          })
          return { id: mapId, slug, type: args.type }
        }
        case SIDEBAR_ITEM_TYPES.files: {
          const { fileId, slug } = await createFileMutation.mutateAsync({
            campaignId: args.campaignId,
            name: trimmedName,
            parentId: resolvedParentId,
            storageId: args.storageId,
            iconName: args.iconName,
            color: args.color,
          })
          return { id: fileId, slug, type: args.type }
        }
        case SIDEBAR_ITEM_TYPES.canvases: {
          const { canvasId, slug } = await createCanvasMutation.mutateAsync({
            campaignId: args.campaignId,
            name: trimmedName,
            parentId: resolvedParentId,
            iconName: args.iconName,
            color: args.color,
          })
          return { id: canvasId, slug, type: args.type }
        }
        default:
          return assertNever(args)
      }
    } catch (error) {
      if (createdRootFolderId) {
        try {
          await rollbackCreatedFolders()
        } catch (rollbackError) {
          logger.error(rollbackError)
        }
      }
      throw error
    }
  }

  return { createItem }
}
