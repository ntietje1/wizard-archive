import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import {
  executeResourceSearchPlan,
  resourceSearchPrefixUpperBound,
} from '@wizard-archive/editor/resources/search-policy'
import type {
  ResourceSearchDocument,
  ResourceSearchPage,
  WorkspaceSearchOutcome,
} from '@wizard-archive/editor/resources/search-policy'
import type { CampaignQueryCtx } from '../../functions'

export async function searchResources(
  ctx: CampaignQueryCtx,
  query: string,
): Promise<WorkspaceSearchOutcome> {
  return await executeResourceSearchPlan(query, {
    titlePrefix: async (normalized, limit) => ({
      documents: rowsToDocuments(
        await ctx.db
          .query('resourceSearchDocuments')
          .withIndex('by_campaign_and_normalized_title', (indexed) =>
            indexed
              .eq('campaignUuid', ctx.resourceScope.campaignId)
              .gte('normalizedTitle', normalized)
              .lt('normalizedTitle', resourceSearchPrefixUpperBound(normalized)),
          )
          .take(limit),
      ),
      complete: true,
    }),
    titleMatches: (normalized, limit) =>
      searchPage(ctx, 'search_title', 'title', normalized, limit),
    bodyMatches: (normalized, limit) => searchPage(ctx, 'search_body', 'body', normalized, limit),
  })
}

async function searchPage(
  ctx: CampaignQueryCtx,
  index: 'search_title' | 'search_body',
  field: 'title' | 'body',
  query: string,
  limit: number,
): Promise<ResourceSearchPage> {
  const page = await ctx.db
    .query('resourceSearchDocuments')
    .withSearchIndex(index, (indexed) =>
      indexed.search(field, query).eq('campaignUuid', ctx.resourceScope.campaignId),
    )
    .paginate({ cursor: null, numItems: limit })
  return { documents: rowsToDocuments(page.page), complete: page.isDone }
}

function rowsToDocuments(
  rows: ReadonlyArray<{ resourceUuid: string; title: string; body: string }>,
): ReadonlyArray<ResourceSearchDocument> {
  return rows.map((row) => ({
    resourceId: assertDomainId(DOMAIN_ID_KIND.resource, row.resourceUuid),
    title: row.title,
    body: row.body,
  }))
}
