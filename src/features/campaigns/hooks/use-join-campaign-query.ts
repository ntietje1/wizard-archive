import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { parseCampaignSlug } from 'shared/campaigns/validation'
import { parseUsername } from 'shared/users/validation'
import type { CampaignSlug } from 'shared/campaigns/validation'
import type { Username } from 'shared/users/validation'

const PLACEHOLDER_USERNAME = parseUsername('placeholder')!
const PLACEHOLDER_SLUG = parseCampaignSlug('placeholder')!

export function useJoinCampaignQuery(
  dmUsername: Username | null,
  campaignSlug: CampaignSlug | null,
) {
  return useQuery({
    ...convexQuery(api.campaigns.queries.getCampaignBySlug, {
      dmUsername: dmUsername ?? PLACEHOLDER_USERNAME,
      slug: campaignSlug ?? PLACEHOLDER_SLUG,
    }),
    enabled: dmUsername !== null && campaignSlug !== null,
  })
}
