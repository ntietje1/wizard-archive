import { useRef } from 'react'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useSidebarItemsCache } from '~/features/sidebar/hooks/useSidebarItemsCache'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'

export function useEmptyTrashBin() {
  const { campaignId } = useCampaign()
  const cache = useSidebarItemsCache()
  const emptyTrashBinMutation = useCampaignMutation(api.sidebarItems.mutations.emptyTrashBin)
  const pendingEmptyRef = useRef(0)
  const snapshotRef = useRef<Array<AnySidebarItem> | undefined>(undefined)
  const rollbackNeededRef = useRef(false)

  const emptyTrashBin = async () => {
    if (!campaignId) return

    const ownsSnapshot = pendingEmptyRef.current === 0
    pendingEmptyRef.current += 1
    if (ownsSnapshot) {
      snapshotRef.current = cache.get(SIDEBAR_ITEM_LOCATION.trash)
      rollbackNeededRef.current = false
      cache.update(SIDEBAR_ITEM_LOCATION.trash, () => [])
    }

    try {
      await emptyTrashBinMutation.mutateAsync({})
    } catch (err) {
      rollbackNeededRef.current = true
      throw err
    } finally {
      pendingEmptyRef.current -= 1
      if (pendingEmptyRef.current === 0) {
        if (rollbackNeededRef.current) {
          cache.update(SIDEBAR_ITEM_LOCATION.trash, () => snapshotRef.current ?? [])
        }
        snapshotRef.current = undefined
        rollbackNeededRef.current = false
      }
    }
  }

  return { emptyTrashBin }
}
