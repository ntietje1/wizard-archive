import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from './useCampaign'
import type { ShareState } from '~/components/context-menu/types'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/baseTypes'

export function useSidebarItemShares(
  itemId: SidebarItemId | undefined,
): ShareState {
  const { campaignWithMembership, isDm } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const sharesQuery = useQuery(
    convexQuery(
      api.shares.queries.getSidebarItemWithShares,
      campaignId && itemId && isDm
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
        allPermissionLevel: undefined,
        sharedMemberIds: new Set<Id<'campaignMembers'>>(),
        playerMembers: [],
        isLoading: sharesQuery.isLoading,
      }
    }

    const sharedMemberIds = new Set(
      sharesQuery.data.shares.map((s) => s.campaignMemberId),
    )

    return {
      allPermissionLevel: sharesQuery.data.allPermissionLevel,
      inheritedAllPermissionLevel: sharesQuery.data.inheritedAllPermissionLevel,
      sharedMemberIds,
      playerMembers: sharesQuery.data.playerMembers,
      isLoading: false,
    }
  }, [sharesQuery.data, sharesQuery.isLoading])
}
