import { useCallback } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { useFolderActions } from './useFolderActions'
import { useMapActions } from './useMapActions'
import { useNoteActions } from './useNoteActions'
import { useFileActions } from './useFileActions'
import { useNavigateOnSlugChange } from './useNavigateOnSlugChange'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { useCampaign } from '~/hooks/useCampaign'

export function useRenameItem() {
  const { updateNote } = useNoteActions()
  const { updateMap } = useMapActions()
  const { updateFolder } = useFolderActions()
  const { updateFile } = useFileActions()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { navigateIfSlugChanged } = useNavigateOnSlugChange()
  const queryClient = useQueryClient()

  const rename = useCallback(
    async (item: AnySidebarItem, newName: string) => {
      if (!item || !campaignId) return

      const previousSlug = item.slug
      let newSlug: string = previousSlug

      try {
        let response
        switch (item.type) {
          case SIDEBAR_ITEM_TYPES.notes:
            response = await updateNote.mutateAsync({
              noteId: item._id,
              name: newName,
            })
            break
          case SIDEBAR_ITEM_TYPES.gameMaps:
            response = await updateMap.mutateAsync({
              mapId: item._id,
              name: newName,
            })
            break
          case SIDEBAR_ITEM_TYPES.folders:
            response = await updateFolder.mutateAsync({
              folderId: item._id,
              name: newName,
            })
            break
          case SIDEBAR_ITEM_TYPES.files:
            response = await updateFile.mutateAsync({
              fileId: item._id,
              name: newName,
            })
            break
          default:
            break
        }

        if (response && response.slug) {
          newSlug = response.slug
        }

        // Update the cache for getSidebarItemBySlug with the new slug
        const updatedItem: AnySidebarItem = {
          ...item,
          slug: newSlug,
          name: newName,
        }

        queryClient.setQueryData(
          convexQuery(api.sidebarItems.queries.getSidebarItemBySlug, {
            campaignId,
            type: item.type,
            slug: newSlug,
          }).queryKey,
          updatedItem,
        )

        navigateIfSlugChanged({
          itemId: item._id,
          itemType: item.type,
          previousSlug,
          newSlug,
          updatedItem,
        })
      } catch (error) {
        console.error(error)
        toast.error('Failed to update name')
        throw error
      }
    },
    [
      campaignId,
      updateNote,
      updateMap,
      updateFolder,
      updateFile,
      navigateIfSlugChanged,
      queryClient,
    ],
  )

  return {
    rename,
  }
}
