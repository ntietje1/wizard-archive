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
  const [titleDocuments, bodyDocuments] = await Promise.all([
    ctx.db
      .query('resourceSearchDocuments')
      .withSearchIndex('search_title', (search) =>
        search.search('title', normalized).eq('campaignUuid', ctx.resourceScope.campaignId),
      )
      .take(MAX_WORKSPACE_SEARCH_CANDIDATES),
    ctx.db
      .query('resourceSearchDocuments')
      .withSearchIndex('search_body', (search) =>
        search.search('body', normalized).eq('campaignUuid', ctx.resourceScope.campaignId),
      )
      .take(MAX_WORKSPACE_SEARCH_CANDIDATES),
  ])
  const documents = new Map(
    [...titleDocuments, ...bodyDocuments].map((document) => [document.resourceUuid, document]),
  )
  return searchResourceDocuments(
    Array.from(documents.values(), (document) => ({
      resourceId: assertDomainId(DOMAIN_ID_KIND.resource, document.resourceUuid),
      title: document.title,
      body: document.body,
    })),
    normalized,
  )
}
