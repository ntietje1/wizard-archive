import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { SidebarItemColor } from 'convex/sidebarItems/validation/color'
import {
  parseSidebarItemColor,
  validateSidebarItemColor,
} from 'convex/sidebarItems/validation/color'
import {
  parseSidebarItemIconName,
  validateSidebarItemIconName,
} from 'convex/sidebarItems/validation/icon'
import type { SidebarItemIconName } from 'convex/sidebarItems/validation/icon'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { assertSidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { GameMap } from 'convex/gameMaps/types'
import type { SidebarFile } from 'convex/files/types'
import type { Canvas } from 'convex/canvases/types'
import type { Note } from 'convex/notes/types'
import type { Folder } from 'convex/folders/types'
import { getSelectedSlug } from '~/features/sidebar/hooks/useSelectedItem'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
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

type EditCanvasArgs = EditItemBase & {
  item: Canvas
}

export type EditItemArgs =
  | EditNoteArgs
  | EditFolderArgs
  | EditMapArgs
  | EditFileArgs
  | EditCanvasArgs

export type EditItemResult = { slug: SidebarItemSlug }

interface EditItemFn {
  (args: EditNoteArgs): Promise<EditItemResult>
  (args: EditFolderArgs): Promise<EditItemResult>
  (args: EditMapArgs): Promise<EditItemResult>
  (args: EditFileArgs): Promise<EditItemResult>
  (args: EditCanvasArgs): Promise<EditItemResult>
  (args: EditItemBase & { item: AnySidebarItem }): Promise<EditItemResult>
}

export function useEditSidebarItem() {
  const validation = useSidebarValidation()
  const { campaignId } = useCampaign()
  const queryClient = useQueryClient()
  const { navigateToItem } = useEditorNavigation()

  const updateNoteMutation = useCampaignMutation(api.notes.mutations.updateNote)
  const updateFolderMutation = useCampaignMutation(api.folders.mutations.updateFolder)
  const updateMapMutation = useCampaignMutation(api.gameMaps.mutations.updateMap)
  const updateFileMutation = useCampaignMutation(api.files.mutations.updateFile)
  const updateCanvasMutation = useCampaignMutation(api.canvases.mutations.updateCanvas)

  const optimisticUpdate = (updater: (prev: Array<AnySidebarItem>) => Array<AnySidebarItem>) => {
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
      const result = validation.validateName(trimmedName, item.parentId, item._id)
      if (!result.valid) throw new Error(result.error)
    }

    const normalizedIconName =
      iconName === undefined || iconName === null
        ? iconName
        : (() => {
            const parsed = parseSidebarItemIconName(iconName)
            if (!parsed) {
              throw new Error(validateSidebarItemIconName(iconName) ?? 'Invalid icon')
            }
            return parsed
          })()

    const normalizedColor =
      color === undefined || color === null
        ? color
        : (() => {
            const parsed = parseSidebarItemColor(color)
            if (!parsed) {
              throw new Error(validateSidebarItemColor(color) ?? 'Invalid color')
            }
            return parsed
          })()

    const currentSlug = getSelectedSlug()
    const isCurrentItem = item.slug === currentSlug

    const optimisticFields: Partial<{
      name: string
      iconName: SidebarItemIconName | null
      color: SidebarItemColor | null
    }> = {}
    if (trimmedName !== undefined) optimisticFields.name = trimmedName
    if (normalizedIconName !== undefined) optimisticFields.iconName = normalizedIconName
    if (normalizedColor !== undefined) optimisticFields.color = normalizedColor

    if (Object.keys(optimisticFields).length > 0) {
      optimisticUpdate((prev) =>
        prev.map((i) => (i._id === item._id ? { ...i, ...optimisticFields } : i)),
      )
    }

    try {
      let slug: SidebarItemSlug

      switch (item.type) {
        case SIDEBAR_ITEM_TYPES.notes: {
          const res = await updateNoteMutation.mutateAsync({
            noteId: item._id,
            name: trimmedName,
            iconName: normalizedIconName,
            color: normalizedColor,
          })
          slug = assertSidebarItemSlug(res.slug)
          break
        }
        case SIDEBAR_ITEM_TYPES.folders: {
          const res = await updateFolderMutation.mutateAsync({
            folderId: item._id,
            name: trimmedName,
            iconName: normalizedIconName,
            color: normalizedColor,
          })
          slug = assertSidebarItemSlug(res.slug)
          break
        }
        case SIDEBAR_ITEM_TYPES.gameMaps: {
          const { imageStorageId } = args as EditMapArgs
          const res = await updateMapMutation.mutateAsync({
            mapId: item._id,
            name: trimmedName,
            iconName: normalizedIconName,
            color: normalizedColor,
            imageStorageId,
          })
          slug = assertSidebarItemSlug(res.slug)
          break
        }
        case SIDEBAR_ITEM_TYPES.files: {
          const { storageId } = args as EditFileArgs
          const res = await updateFileMutation.mutateAsync({
            fileId: item._id,
            name: trimmedName,
            iconName: normalizedIconName,
            color: normalizedColor,
            storageId,
          })
          slug = assertSidebarItemSlug(res.slug)
          break
        }
        case SIDEBAR_ITEM_TYPES.canvases: {
          const res = await updateCanvasMutation.mutateAsync({
            canvasId: item._id,
            name: trimmedName,
            iconName: normalizedIconName,
            color: normalizedColor,
          })
          slug = assertSidebarItemSlug(res.slug)
          break
        }
        default:
          return assertNever(item)
      }

      if (slug !== item.slug) {
        optimisticUpdate((prev) => prev.map((i) => (i._id === item._id ? { ...i, slug } : i)))
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
