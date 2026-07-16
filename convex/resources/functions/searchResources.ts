import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { WorkspaceSearchResult } from '@wizard-archive/editor/resources/editor-runtime-contract'
import {
  MAX_WORKSPACE_SEARCH_CANDIDATES,
  MAX_WORKSPACE_SEARCH_RESULTS,
  normalizeSearchQuery,
  resourceSearchPrefixUpperBound,
  searchResourceDocuments,
} from '@wizard-archive/editor/resources/search-policy'
import type { CampaignQueryCtx } from '../../functions'

export async function searchResources(
  ctx: CampaignQueryCtx,
  query: string,
): Promise<ReadonlyArray<WorkspaceSearchResult>> {
  const normalized = normalizeSearchQuery(query)
  if (!normalized) return []
  const prefixDocuments = await ctx.db
    .query('resourceSearchDocuments')
    .withIndex('by_campaign_and_normalized_title', (indexed) =>
      indexed
        .eq('campaignUuid', ctx.resourceScope.campaignId)
        .gte('normalizedTitle', normalized)
        .lt('normalizedTitle', resourceSearchPrefixUpperBound(normalized)),
    )
    .take(MAX_WORKSPACE_SEARCH_RESULTS)
  if (prefixDocuments.length === MAX_WORKSPACE_SEARCH_RESULTS) {
    return rankDocuments(prefixDocuments, normalized)
  }
  const [titleDocuments, bodyDocuments] = await Promise.all([
    ctx.db
      .query('resourceSearchDocuments')
      .withSearchIndex('search_title', (indexed) =>
        indexed.search('title', normalized).eq('campaignUuid', ctx.resourceScope.campaignId),
      )
      .paginate({ cursor: null, numItems: MAX_WORKSPACE_SEARCH_CANDIDATES }),
    ctx.db
      .query('resourceSearchDocuments')
      .withSearchIndex('search_body', (indexed) =>
        indexed.search('body', normalized).eq('campaignUuid', ctx.resourceScope.campaignId),
      )
      .paginate({ cursor: null, numItems: MAX_WORKSPACE_SEARCH_CANDIDATES }),
  ])
  if (!titleDocuments.isDone || !bodyDocuments.isDone) {
    throw new Error('Search query exceeds the bounded candidate set')
  }
  const documents = new Map(
    [...prefixDocuments, ...titleDocuments.page, ...bodyDocuments.page].map((document) => [
      document.resourceUuid,
      document,
    ]),
  )
  return rankDocuments(Array.from(documents.values()), normalized)
}

function rankDocuments(
  documents: ReadonlyArray<{ resourceUuid: string; title: string; body: string }>,
  query: string,
) {
  return searchResourceDocuments(
    documents.map((document) => ({
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, document.resourceUuid),
      title: document.title,
      body: document.body,
    })),
    query,
  )
}
