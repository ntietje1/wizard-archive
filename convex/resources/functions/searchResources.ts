import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { WorkspaceSearchResult } from '@wizard-archive/editor/resources/editor-runtime-contract'
import {
  MAX_WORKSPACE_SEARCH_RESULTS,
  normalizeSearchQuery,
  searchResourceDocuments,
} from '@wizard-archive/editor/resources/search-policy'
import type { CampaignQueryCtx } from '../../functions'

const MAX_SEARCH_CANDIDATES = MAX_WORKSPACE_SEARCH_RESULTS * 4

export async function searchResources(
  ctx: CampaignQueryCtx,
  query: string,
): Promise<ReadonlyArray<WorkspaceSearchResult>> {
  const normalized = normalizeSearchQuery(query)
  if (!normalized) return []
  const documents = await ctx.db
    .query('resourceSearchDocuments')
    .withSearchIndex('search_text', (search) =>
      search.search('searchableText', normalized).eq('campaignUuid', ctx.resourceScope.campaignId),
    )
    .take(MAX_SEARCH_CANDIDATES)
  return searchResourceDocuments(
    documents.map((document) => ({
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, document.resourceUuid),
      title: document.title,
      body: document.body,
    })),
    normalized,
  )
}
