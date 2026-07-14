import type { Doc } from '../_generated/dataModel'
import type { CampaignSlug } from '../../shared/campaigns/validation'

export type CampaignRow = Omit<Doc<'campaigns'>, 'slug'> & { slug: CampaignSlug }
export type CampaignMemberRow = Doc<'campaignMembers'>
