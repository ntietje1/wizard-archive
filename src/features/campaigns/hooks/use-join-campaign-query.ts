import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { CampaignSlug } from 'shared/campaigns/validation'
import type { Username } from 'shared/users/validation'

const PLACEHOLDER_IDENTITY = { dmUsername: 'user', slug: 'campaign' } as const

export function useJoinCampaignQuery(
  identity: { dmUsername: Username; campaignSlug: CampaignSlug } | null,
) {
  return useQuery({
    ...convexQuery(api.campaigns.queries.getCampaignInvitation, {
      dmUsername: identity?.dmUsername ?? PLACEHOLDER_IDENTITY.dmUsername,
      slug: identity?.campaignSlug ?? PLACEHOLDER_IDENTITY.slug,
    }),
    enabled: identity !== null,
  })
}
