import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useSidebarItemsCache } from '~/features/sidebar/hooks/useSidebarItemsCache'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'

export function useEmptyTrashBin() {
  const { campaignId } = useCampaign()
  const cache = useSidebarItemsCache()
  const emptyTrashBinMutation = useCampaignMutation(api.sidebarItems.mutations.emptyTrashBin)

  const emptyTrashBin = async () => {
    if (!campaignId) return

    const previousItems = cache.get(SIDEBAR_ITEM_LOCATION.trash)
    cache.update(SIDEBAR_ITEM_LOCATION.trash, () => [])

    try {
      await emptyTrashBinMutation.mutateAsync({})
    } catch (err) {
      cache.update(SIDEBAR_ITEM_LOCATION.trash, () => previousItems)
      throw err
    }
  }

  return { emptyTrashBin }
}
