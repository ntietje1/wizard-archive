import { api } from 'convex/_generated/api'
import type { CreateParentTarget } from 'convex/sidebarItems/validation/parent'
import { coerceSidebarItemColorForInput } from 'convex/sidebarItems/validation/color'
import { coerceSidebarItemIconNameForInput } from 'convex/sidebarItems/validation/icon'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { assertSidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { validateCreateItemLocally } from 'convex/sidebarItems/validation/parent'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { assertNever } from '~/shared/utils/utils'

interface CreateItemBase {
  campaignId: Id<'campaigns'>
  name: string
  parentTarget: CreateParentTarget
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
  slug: SidebarItemSlug
  type: SidebarItemType
}

export function useCreateSidebarItem() {
  const { itemsMap, parentItemsMap } = useActiveSidebarItems()
  const createNoteMutation = useAppMutation(api.notes.mutations.createNote)
  const createFolderMutation = useAppMutation(api.folders.mutations.createFolder)
  const createMapMutation = useAppMutation(api.gameMaps.mutations.createMap)
  const createFileMutation = useAppMutation(api.files.mutations.createFile)
  const createCanvasMutation = useAppMutation(api.canvases.mutations.createCanvas)

  const validateCreateItem = (args: CreateItemArgs) => {
    return validateCreateItemLocally(
      {
        name: args.name,
        parentTarget: args.parentTarget,
      },
      itemsMap,
      parentItemsMap,
    )
  }

  const createItem = async (args: CreateItemArgs): Promise<CreateItemResult> => {
    const trimmedName = args.name.trim()
    const nameResult = validateCreateItem(args)
    if (!nameResult.valid) {
      throw new Error(nameResult.error)
    }

    const iconName =
      args.iconName === undefined ? undefined : coerceSidebarItemIconNameForInput(args.iconName)

    const color = args.color === undefined ? undefined : coerceSidebarItemColorForInput(args.color)

    switch (args.type) {
      case SIDEBAR_ITEM_TYPES.notes: {
        const { noteId, slug } = await createNoteMutation.mutateAsync({
          campaignId: args.campaignId,
          name: trimmedName,
          parentTarget: args.parentTarget,
          iconName,
          color,
          content: args.content,
        })
        return { id: noteId, slug: assertSidebarItemSlug(slug), type: args.type }
      }
      case SIDEBAR_ITEM_TYPES.folders: {
        const { folderId, slug } = await createFolderMutation.mutateAsync({
          campaignId: args.campaignId,
          name: trimmedName,
          parentTarget: args.parentTarget,
          iconName,
          color,
        })
        return { id: folderId, slug: assertSidebarItemSlug(slug), type: args.type }
      }
      case SIDEBAR_ITEM_TYPES.gameMaps: {
        const { mapId, slug } = await createMapMutation.mutateAsync({
          campaignId: args.campaignId,
          name: trimmedName,
          parentTarget: args.parentTarget,
          imageStorageId: args.imageStorageId,
          iconName,
          color,
        })
        return { id: mapId, slug: assertSidebarItemSlug(slug), type: args.type }
      }
      case SIDEBAR_ITEM_TYPES.files: {
        const { fileId, slug } = await createFileMutation.mutateAsync({
          campaignId: args.campaignId,
          name: trimmedName,
          parentTarget: args.parentTarget,
          storageId: args.storageId,
          iconName,
          color,
        })
        return { id: fileId, slug: assertSidebarItemSlug(slug), type: args.type }
      }
      case SIDEBAR_ITEM_TYPES.canvases: {
        const { canvasId, slug } = await createCanvasMutation.mutateAsync({
          campaignId: args.campaignId,
          name: trimmedName,
          parentTarget: args.parentTarget,
          iconName,
          color,
        })
        return { id: canvasId, slug: assertSidebarItemSlug(slug), type: args.type }
      }
      default:
        return assertNever(args)
    }
  }

  return { createItem, validateCreateItem }
}
