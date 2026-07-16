import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { WorkspaceSearchResult } from '@wizard-archive/editor/resources/editor-runtime-contract'
import {
  MAX_WORKSPACE_SEARCH_CANDIDATES,
  normalizeSearchQuery,
  searchResourceDocuments,
} from '@wizard-archive/editor/resources/search-policy'
import type { CampaignQueryCtx } from '../../functions'

export async function searchResources(
  ctx: CampaignQueryCtx,
  query: string,
): Promise<ReadonlyArray<WorkspaceSearchResult>> {
  const normalized = normalizeSearchQuery(query)
  if (!normalized) return []
  const documents = await ctx.db
    .query('resourceSearchDocuments')
    .withIndex('by_campaign_and_resource', (indexed) =>
      indexed.eq('campaignUuid', ctx.resourceScope.campaignId),
    )
    .order('asc')
    .take(MAX_WORKSPACE_SEARCH_CANDIDATES)
  return searchResourceDocuments(
    documents.map((document) => ({
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, document.resourceUuid),
      title: document.title,
      body: document.body,
    })),
    normalized,
  )
}
