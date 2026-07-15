import { MAX_RESOURCE_BOOKMARKS_PER_ACTOR } from '@wizard-archive/editor/resources/command-contract'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'

export async function loadActorBookmarks(ctx: CampaignMutationCtx | CampaignQueryCtx) {
  const rows = await ctx.db
    .query('resourceBookmarks')
    .withIndex('by_member', (index) =>
      index
        .eq('campaignUuid', ctx.resourceScope.campaignId)
        .eq('memberUuid', ctx.resourceScope.actorId),
    )
    .take(MAX_RESOURCE_BOOKMARKS_PER_ACTOR + 1)
  if (rows.length > MAX_RESOURCE_BOOKMARKS_PER_ACTOR) {
    throw new TypeError('Bookmark storage exceeds its bound')
  }
  return rows
}
