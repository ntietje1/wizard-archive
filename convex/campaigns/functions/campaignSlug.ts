import { campaignSlugFromName, campaignSlugWithSuffix } from '../../../shared/campaigns/validation'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { MutationCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'
import type { CampaignSlug } from '../../../shared/campaigns/validation'

const MAX_SLUG_SUFFIX = 1_000

export async function generateAvailableCampaignSlug(
  db: MutationCtx['db'],
  dmUserId: Id<'userProfiles'>,
  name: string,
  excludeCampaignId?: Id<'campaigns'>,
): Promise<CampaignSlug> {
  const base = campaignSlugFromName(name)
  for (let suffix = 0; suffix <= MAX_SLUG_SUFFIX; suffix += 1) {
    const candidate = suffix === 0 ? base : campaignSlugWithSuffix(base, suffix)
    const conflict = await db
      .query('campaigns')
      .withIndex('by_slug_dm', (query) => query.eq('slug', candidate).eq('dmUserId', dmUserId))
      .unique()
    if (!conflict || conflict._id === excludeCampaignId) return candidate
  }
  throwClientError(ERROR_CODE.CONFLICT, 'Unable to generate a unique campaign link')
}
