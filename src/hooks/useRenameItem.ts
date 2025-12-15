import { useCallback } from 'react'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { useNoteActions } from './useNoteActions'
import { useTagActions } from './useTagActions'
import { useMapActions } from './useMapActions'
import { useFolderActions } from './useFolderActions'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation, useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/contexts/CampaignContext'
import { toast } from 'sonner'
import { useCurrentItem } from './useCurrentItem'
import { useEditorNavigation } from './useEditorNavigation'

export function useRenameItem(item: AnySidebarItem | null) {
  const { updateNote } = useNoteActions()
  const { updateTag } = useTagActions()
  const { updateMap } = useMapActions()
  const { updateFolder } = useFolderActions()
  const { campaignWithMembership } = useCampaign()
  const convex = useConvex()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { item: currentItem } = useCurrentItem()
  const { navigateToItem } = useEditorNavigation()

  const updateCategory = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.updateTagCategory),
  })

  const rename = useCallback(
    async (newName: string) => {
      if (!item || !newName || !campaignId) return

      const oldSlug = item.slug
      const isCurrentItem = currentItem?._id === item._id

      try {
        switch (item.type) {
          case 'notes':
            await updateNote.mutateAsync({ noteId: item._id, name: newName })
            break
          case 'tags':
            await updateTag.mutateAsync({ tagId: item._id, name: newName })
            break
          case 'gameMaps':
            await updateMap.mutateAsync({ mapId: item._id, name: newName })
            break
          case 'folders':
            await updateFolder.mutateAsync({
              folderId: item._id,
              name: newName,
            })
            break
          case 'tagCategories': {
            await updateCategory.mutateAsync({
              categoryId: item._id,
              categoryName: newName,
            })
            break
          }
          default:
            break
        }

        // If this is the current item and slug might have changed, check and navigate
        if (isCurrentItem) {
          const updatedItem = await convex.query(
            api.sidebarItems.queries.getSidebarItem,
            {
              id: item._id,
              campaignId,
            },
          )

          if (updatedItem && updatedItem.slug !== oldSlug) {
            navigateToItem(updatedItem)
          }
        }
      } catch (error) {
        console.error(error)
        toast.error('Failed to update name')
        throw error
      }
    },
    [
      convex,
      item,
      campaignId,
      updateNote,
      updateTag,
      updateMap,
      updateFolder,
      updateCategory,
      currentItem,
      navigateToItem,
    ],
  )

  return {
    rename: (item?.type === 'tagCategories') ? undefined : rename,
  }
}

