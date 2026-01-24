import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_SHARE_STATUS } from 'convex/sidebarItems/baseTypes'
import { useCampaign } from './useCampaign'
import type {
  SidebarItemId,
  SidebarItemShareStatus,
} from 'convex/sidebarItems/types'
import type { ShareState } from '~/components/context-menu/types'
import type { Id } from 'convex/_generated/dataModel'


export function useSidebarItemShares(
  itemId: SidebarItemId | undefined,
): ShareState {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const sharesQuery = useQuery(
    convexQuery(
      api.shares.queries.getSidebarItemWithShares,
      campaignId && itemId
        ? {
            campaignId,
            sidebarItemId: itemId,
          }
        : 'skip',
    ),
  )

  return useMemo(() => {
    if (!sharesQuery.data) {
      return {
        shareStatus: SIDEBAR_ITEM_SHARE_STATUS.NOT_SHARED,
        sharedMemberIds: new Set<Id<'campaignMembers'>>(),
        playerMembers: [],
        isLoading: sharesQuery.isLoading,
      }
    }

    const shareStatus: SidebarItemShareStatus = sharesQuery.data.shareStatus

    // Only populate sharedMemberIds if status is individually_shared
    let sharedMemberIds: Set<Id<'campaignMembers'>>
    if (shareStatus === SIDEBAR_ITEM_SHARE_STATUS.INDIVIDUALLY_SHARED) {
      sharedMemberIds = new Set(
        sharesQuery.data.shares.map((s) => s.campaignMemberId),
      )
    } else {
      sharedMemberIds = new Set<Id<'campaignMembers'>>()
    }

    return {
      shareStatus,
      sharedMemberIds,
      playerMembers: sharesQuery.data.playerMembers,
      isLoading: false,
    }
  }, [sharesQuery.data, sharesQuery.isLoading])
}
