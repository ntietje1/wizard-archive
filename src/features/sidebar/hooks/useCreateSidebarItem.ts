import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { assertNever } from '~/shared/utils/utils'

interface CreateItemBase {
  campaignId: Id<'campaigns'>
  name: string
  parentId: Id<'sidebarItems'> | null
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

export function useCreateSidebarItem() {
  const validation = useSidebarValidation()
  const createNoteMutation = useAppMutation(api.notes.mutations.createNote)
  const createFolderMutation = useAppMutation(api.folders.mutations.createFolder)
  const createMapMutation = useAppMutation(api.gameMaps.mutations.createMap)
  const createFileMutation = useAppMutation(api.files.mutations.createFile)
  const createCanvasMutation = useAppMutation(api.canvases.mutations.createCanvas)

  const createItem = async (args: CreateItemArgs): Promise<CreateItemResult> => {
    const trimmedName = args.name.trim()
    const nameResult = validation.validateName(trimmedName, args.parentId)
    if (!nameResult.valid) throw new Error(nameResult.error)

    switch (args.type) {
      case SIDEBAR_ITEM_TYPES.notes: {
        const { noteId, slug } = await createNoteMutation.mutateAsync({
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
        const { folderId, slug } = await createFolderMutation.mutateAsync({
          campaignId: args.campaignId,
          name: trimmedName,
          parentId: args.parentId,
          iconName: args.iconName,
          color: args.color,
        })
        return { id: folderId, slug, type: args.type }
      }
      case SIDEBAR_ITEM_TYPES.gameMaps: {
        const { mapId, slug } = await createMapMutation.mutateAsync({
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
        const { fileId, slug } = await createFileMutation.mutateAsync({
          campaignId: args.campaignId,
          name: trimmedName,
          parentId: args.parentId,
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
          parentId: args.parentId,
          iconName: args.iconName,
          color: args.color,
        })
        return { id: canvasId, slug, type: args.type }
      }
      default:
        return assertNever(args)
    }
  }

  return { createItem }
}
