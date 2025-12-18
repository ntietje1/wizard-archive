import { useCallback } from 'react'
import {
  SIDEBAR_ITEM_TYPES,
  type AnySidebarItem,
} from 'convex/sidebarItems/types'
import { useNoteActions } from './useNoteActions'
import { useTagActions } from './useTagActions'
import { useMapActions } from './useMapActions'
import { useFolderActions } from './useFolderActions'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation, useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/contexts/CampaignContext'
import { toast } from 'sonner'
import { useEditorNavigation } from './useEditorNavigation'
import { useSearch } from '@tanstack/react-router'
import type { EditorSearch } from '~/components/notes-page/validate-search'

export function useRenameItem(item: AnySidebarItem | null) {
  const { updateNote } = useNoteActions()
  const { updateTag } = useTagActions()
  const { updateMap } = useMapActions()
  const { updateFolder } = useFolderActions()
  const { campaignWithMembership } = useCampaign()
  const convex = useConvex()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { navigateToItemAndPage } = useEditorNavigation()

  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
  }) as EditorSearch

  const updateCategory = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.updateTagCategory),
  })

  const rename = useCallback(
    async (newName: string) => {
      if (!item || !newName || !campaignId) return

      try {
        switch (item.type) {
          case SIDEBAR_ITEM_TYPES.notes:
            await updateNote.mutateAsync({ noteId: item._id, name: newName })
            break
          case SIDEBAR_ITEM_TYPES.tags:
            await updateTag.mutateAsync({ tagId: item._id, name: newName })
            break
          case SIDEBAR_ITEM_TYPES.gameMaps:
            await updateMap.mutateAsync({ mapId: item._id, name: newName })
            break
          case SIDEBAR_ITEM_TYPES.folders:
            await updateFolder.mutateAsync({
              folderId: item._id,
              name: newName,
            })
            break
          case SIDEBAR_ITEM_TYPES.tagCategories: {
            await updateCategory.mutateAsync({
              categoryId: item._id,
              name: newName,
            })
            break
          }
          default:
            break
        }

        const updatedItem = await convex.query(
          api.sidebarItems.queries.getSidebarItem,
          {
            id: item._id,
            campaignId,
          },
        )

        if (!updatedItem) return

        navigateToItemAndPage(updatedItem, search.page)
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
      navigateToItemAndPage,
      search,
    ],
  )

  return {
    rename: item?.type === 'tagCategories' ? undefined : rename,
  }
}
