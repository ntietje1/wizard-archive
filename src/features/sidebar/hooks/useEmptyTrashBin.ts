import { useEffect, useRef, useState } from 'react'
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
  const pendingEmptyRef = useRef(false)
  const snapshotRef = useRef<Array<AnySidebarItem> | undefined>(undefined)
  const isMountedRef = useRef(true)
  const [isEmptying, setIsEmptying] = useState(false)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const emptyTrashBin = async () => {
    if (!campaignId) return false
    if (pendingEmptyRef.current) {
      return false
    }

    pendingEmptyRef.current = true
    setIsEmptying(true)
    snapshotRef.current = cache.get(SIDEBAR_ITEM_LOCATION.trash)
    if (isMountedRef.current) {
      cache.update(SIDEBAR_ITEM_LOCATION.trash, () => [])
    }

    try {
      await emptyTrashBinMutation.mutateAsync({})
      return true
    } catch (err) {
      if (isMountedRef.current) {
        cache.update(SIDEBAR_ITEM_LOCATION.trash, () => snapshotRef.current ?? [])
      }
      throw err
    } finally {
      pendingEmptyRef.current = false
      snapshotRef.current = undefined
      if (isMountedRef.current) setIsEmptying(false)
    }
  }

  return { emptyTrashBin, isEmptying }
}
