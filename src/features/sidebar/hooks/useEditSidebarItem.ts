import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_TYPES,
} from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { GameMap } from 'convex/gameMaps/types'
import type { SidebarFile } from 'convex/files/types'
import type { Note } from 'convex/notes/types'
import type { Folder } from 'convex/folders/types'
import { getSelectedSlug } from '~/features/sidebar/hooks/useSelectedItem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { assertNever } from '~/shared/utils/utils'

interface EditItemBase {
  name?: string
  iconName?: string | null
  color?: string | null
}

type EditNoteArgs = EditItemBase & {
  item: Note
}

type EditFolderArgs = EditItemBase & {
  item: Folder
}

type EditMapArgs = EditItemBase & {
  item: GameMap
  imageStorageId?: Id<'_storage'> | null
}

type EditFileArgs = EditItemBase & {
  item: SidebarFile
  storageId?: Id<'_storage'> | null
}

export type EditItemArgs =
  | EditNoteArgs
  | EditFolderArgs
  | EditMapArgs
  | EditFileArgs

export type EditItemResult = { slug: string }

interface EditItemFn {
  (args: EditNoteArgs): Promise<EditItemResult>
  (args: EditFolderArgs): Promise<EditItemResult>
  (args: EditMapArgs): Promise<EditItemResult>
  (args: EditFileArgs): Promise<EditItemResult>
  (args: EditItemBase & { item: AnySidebarItem }): Promise<EditItemResult>
}

export function useEditSidebarItem() {
  const validation = useSidebarValidation()
  const { campaignId } = useCampaign()
  const queryClient = useQueryClient()
  const { navigateToItem } = useEditorNavigation()

  const updateNoteMutation = useAppMutation(api.notes.mutations.updateNote)
  const updateFolderMutation = useAppMutation(
    api.folders.mutations.updateFolder,
  )
  const updateMapMutation = useAppMutation(api.gameMaps.mutations.updateMap)
  const updateFileMutation = useAppMutation(api.files.mutations.updateFile)

  const optimisticUpdate = (
    updater: (prev: Array<AnySidebarItem>) => Array<AnySidebarItem>,
  ) => {
    if (!campaignId) return
    queryClient.setQueryData<Array<AnySidebarItem>>(
      convexQuery(api.sidebarItems.queries.getSidebarItemsByLocation, {
        campaignId,
        location: SIDEBAR_ITEM_LOCATION.sidebar,
      }).queryKey,
      (prev) => (prev ? updater(prev) : prev),
    )
  }

  const editItem: EditItemFn = async (
    args: EditItemBase & { item: AnySidebarItem },
  ): Promise<EditItemResult> => {
    const { item, name, iconName, color } = args

    const trimmedName = name?.trim()
    if (trimmedName !== undefined) {
      const result = validation.validateName(
        trimmedName,
        item.parentId,
        item._id,
      )
      if (!result.valid) throw new Error(result.error)
    }

    const currentSlug = getSelectedSlug()
    const isCurrentItem = item.slug === currentSlug

    const optimisticFields: Partial<EditItemBase> = {}
    if (trimmedName !== undefined) optimisticFields.name = trimmedName
    if (iconName !== undefined) optimisticFields.iconName = iconName
    if (color !== undefined) optimisticFields.color = color

    if (Object.keys(optimisticFields).length > 0) {
      optimisticUpdate((prev) =>
        prev.map((i) =>
          i._id === item._id ? { ...i, ...optimisticFields } : i,
        ),
      )
    }

    try {
      let slug: string

      switch (item.type) {
        case SIDEBAR_ITEM_TYPES.notes: {
          const res = await updateNoteMutation.mutateAsync({
            noteId: item._id,
            name: trimmedName,
            iconName,
            color,
          })
          slug = res.slug
          break
        }
        case SIDEBAR_ITEM_TYPES.folders: {
          const res = await updateFolderMutation.mutateAsync({
            folderId: item._id,
            name: trimmedName,
            iconName,
            color,
          })
          slug = res.slug
          break
        }
        case SIDEBAR_ITEM_TYPES.gameMaps: {
          const { imageStorageId } = args as EditMapArgs
          const res = await updateMapMutation.mutateAsync({
            mapId: item._id,
            name: trimmedName,
            iconName,
            color,
            imageStorageId,
          })
          slug = res.slug
          break
        }
        case SIDEBAR_ITEM_TYPES.files: {
          const { storageId } = args as EditFileArgs
          const res = await updateFileMutation.mutateAsync({
            fileId: item._id,
            name: trimmedName,
            iconName,
            color,
            storageId,
          })
          slug = res.slug
          break
        }
        default:
          return assertNever(item)
      }

      if (slug !== item.slug) {
        optimisticUpdate((prev) =>
          prev.map((i) => (i._id === item._id ? { ...i, slug } : i)),
        )
        if (isCurrentItem) {
          await navigateToItem(slug, true)
        }
      }

      return { slug }
    } catch (err) {
      optimisticUpdate((prev) =>
        prev.map((i) =>
          i._id === item._id
            ? {
                ...i,
                name: item.name,
                slug: item.slug,
                iconName: item.iconName,
                color: item.color,
              }
            : i,
        ),
      )
      throw err
    }
  }

  return { editItem }
}
