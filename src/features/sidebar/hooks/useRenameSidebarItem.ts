import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { getSelectedTypeAndSlug } from '~/features/sidebar/hooks/useSelectedItem'
import { useEditorNavigationContext } from '~/features/sidebar/hooks/useEditorNavigationContext'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export function useRenameSidebarItem() {
  const validation = useSidebarValidation()
  const { campaignId } = useCampaign()
  const queryClient = useQueryClient()
  const { navigateToItem } = useEditorNavigationContext()

  const updateSidebarItemMutation = useAppMutation(
    api.sidebarItems.mutations.updateSidebarItem,
    { errorMessage: 'Failed to update item' },
  )

  const optimisticUpdate = (
    updater: (prev: Array<AnySidebarItem>) => Array<AnySidebarItem>,
  ) => {
    if (!campaignId) return
    queryClient.setQueryData<Array<AnySidebarItem>>(
      convexQuery(api.sidebarItems.queries.getAllSidebarItems, {
        campaignId,
      }).queryKey,
      (prev) => (prev ? updater(prev) : prev),
    )
  }

  const rename = async (item: AnySidebarItem, newName: string) => {
    const trimmedName = newName.trim()
    const result = validation.validateName(trimmedName, item.parentId, item._id)
    if (!result.valid) throw new Error(result.error)

    const current = getSelectedTypeAndSlug()
    const isCurrentItem =
      current && item.type === current.type && item.slug === current.slug

    optimisticUpdate((prev) =>
      prev.map((i) => (i._id === item._id ? { ...i, name: trimmedName } : i)),
    )

    try {
      const res = await updateSidebarItemMutation.mutateAsync({
        itemId: item._id,
        name: trimmedName,
      })
      if (res?.slug) {
        optimisticUpdate((prev) =>
          prev.map((i) => (i._id === item._id ? { ...i, slug: res.slug } : i)),
        )
        if (isCurrentItem && res.slug !== item.slug) {
          await navigateToItem({ type: item.type, slug: res.slug }, true)
        }
      }
    } catch (err) {
      optimisticUpdate((prev) =>
        prev.map((i) =>
          i._id === item._id ? { ...i, name: item.name, slug: item.slug } : i,
        ),
      )
      throw err
    }
  }

  return { rename }
}
