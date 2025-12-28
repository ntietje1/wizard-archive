import { useMemo } from 'react'
import {
  createCampaignEnhancer,
  createCategoryEnhancer,
  createMapViewEnhancer,
} from '../context'
import type { ContextEnhancer } from '../context'
import type { TagCategory } from 'convex/tags/types'
import { useCampaign } from '~/contexts/CampaignContext'
import { useMapView } from '~/contexts/MapViewContext'

interface UseContextEnhancersOptions {
  category?: TagCategory
  includeMapView?: boolean
  includeCampaign?: boolean
}

/**
 * Hook that creates common context enhancers.
 * This centralizes the logic for gathering context from common sources.
 *
 * @param options - Configuration for which enhancers to include
 * @returns Array of enhancers ready to pass to `useContextMenu`
 */
export function useContextEnhancers(
  options: UseContextEnhancersOptions = {},
): Array<ContextEnhancer> {
  const { campaignWithMembership } = useCampaign()
  const { mapId, pinnedItemIds } = useMapView()
  const { category, includeMapView = true, includeCampaign = true } = options

  return useMemo(() => {
    const enhancers: Array<ContextEnhancer> = []

    if (includeCampaign) {
      enhancers.push(
        createCampaignEnhancer(
          campaignWithMembership.data?.member.role,
          campaignWithMembership.data?.member.userId,
        ),
      )
    }

    if (includeMapView) {
      enhancers.push(createMapViewEnhancer(mapId ?? undefined, pinnedItemIds))
    }

    if (category) {
      enhancers.push(createCategoryEnhancer(category))
    }

    return enhancers
  }, [
    campaignWithMembership.data?.member.role,
    campaignWithMembership.data?.member.userId,
    mapId,
    pinnedItemIds,
    category,
    includeMapView,
    includeCampaign,
  ])
}
