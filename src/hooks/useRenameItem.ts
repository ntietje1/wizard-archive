import { useCallback } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { useSearch } from '@tanstack/react-router'
import { useEditorNavigation } from './useEditorNavigation'
import { useFolderActions } from './useFolderActions'
import { useMapActions } from './useMapActions'
import { useTagActions } from './useTagActions'
import { useNoteActions } from './useNoteActions'
import { useCurrentItem } from './useCurrentItem'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { useCampaign } from '~/contexts/CampaignContext'

export function useRenameItem(item: AnySidebarItem | null) {
  const { item: currentItem } = useCurrentItem()
  const { updateNote } = useNoteActions()
  const { updateTag } = useTagActions()
  const { updateMap } = useMapActions()
  const { updateFolder } = useFolderActions()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { navigateToItemAndPage } = useEditorNavigation()
  const queryClient = useQueryClient()

  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
  })

  const updateCategory = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.updateTagCategory),
  })

  const rename = useCallback(
    async (newName: string) => {
      if (!item || !newName || !campaignId) return

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
          case SIDEBAR_ITEM_TYPES.tags:
            response = await updateTag.mutateAsync({
              tagId: item._id,
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
          case SIDEBAR_ITEM_TYPES.tagCategories:
            response = await updateCategory.mutateAsync({
              categoryId: item._id,
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
        
        if (campaignId) {
          queryClient.setQueryData(
            convexQuery(
              api.sidebarItems.queries.getSidebarItemBySlug,
              {
                campaignId,
                type: item.type,
                slug: newSlug,
              },
            ).queryKey,
            updatedItem,
          )
        }

        if (
          currentItem &&
          currentItem._id === item._id &&
          previousSlug !== newSlug
        ) {
          navigateToItemAndPage(
            updatedItem,
            search.page,
            true,
          )
        }
      } catch (error) {
        console.error(error)
        toast.error('Failed to update name')
        throw error
      }
    },
    [
      item,
      campaignId,
      updateNote,
      updateTag,
      updateMap,
      updateFolder,
      updateCategory,
      navigateToItemAndPage,
      search,
      currentItem,
      queryClient,
    ],
  )

  return {
    rename,
  }
}
