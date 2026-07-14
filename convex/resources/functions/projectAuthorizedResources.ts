import { sha256Digest } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  AuthorizedResourceSnapshot,
  AuthorizedResourceSummary,
  ResourceCollectionQuery,
  ResourceProjectionScope,
} from '@wizard-archive/editor/resources/index-contract'
import {
  RESOURCE_INDEX_SCHEMA,
  authorizedResourceSummaryFromRecord,
  normalizeResourceCollectionQuery,
} from '@wizard-archive/editor/resources/index-contract'
import { MAX_RESOURCE_CATALOG_PAGE_SIZE } from '@wizard-archive/editor/resources/catalog-contract'
import type { ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import { indexRevision } from '@wizard-archive/editor/resources/workspace-index'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { CampaignQueryCtx } from '../../functions'
import { ConvexResourceCatalog } from './ConvexResourceCatalog'

type CollectionPage = Readonly<{
  snapshot: AuthorizedResourceSnapshot
  cursor: string | null
}>

function projectionScope(ctx: CampaignQueryCtx): ResourceProjectionScope {
  return {
    ...ctx.resourceScope,
    projection: ctx.membership.role === CAMPAIGN_MEMBER_ROLE.DM ? 'dm' : 'player',
    schema: RESOURCE_INDEX_SCHEMA,
  }
}

async function visibleSpine(
  catalog: ConvexResourceCatalog,
  resource: ResourceRecord,
): Promise<ReadonlyArray<ResourceRecord>> {
  const ancestors: Array<ResourceRecord> = []
  const visited = new Set<ResourceId>([resource.id])
  let parentId = resource.parentId
  while (parentId !== null) {
    if (visited.has(parentId)) throw new Error('Resource hierarchy contains a cycle')
    visited.add(parentId)
    const parent = await catalog.getResource(resource.campaignId, parentId)
    if (!parent || parent.kind !== 'folder') {
      throw new Error('Resource hierarchy contains an invalid parent')
    }
    ancestors.push(parent)
    parentId = parent.parentId
  }
  return ancestors.reverse()
}

function uniqueSummaries(
  resources: ReadonlyArray<ResourceRecord>,
): ReadonlyArray<AuthorizedResourceSummary> {
  const summaries = new Map<ResourceId, AuthorizedResourceSummary>()
  for (const resource of resources) {
    summaries.set(resource.id, authorizedResourceSummaryFromRecord(resource))
  }
  return Array.from(summaries.values()).sort((left, right) => left.id.localeCompare(right.id))
}

async function snapshotRevision(
  snapshot: Omit<AuthorizedResourceSnapshot, 'revision'>,
): Promise<string> {
  return await sha256Digest(new TextEncoder().encode(JSON.stringify(snapshot)))
}

async function createSnapshot(
  snapshot: Omit<AuthorizedResourceSnapshot, 'revision'>,
): Promise<AuthorizedResourceSnapshot> {
  return { ...snapshot, revision: indexRevision(await snapshotRevision(snapshot)) }
}

export async function loadAuthorizedResource(
  ctx: CampaignQueryCtx,
  resourceIdValue: string,
): Promise<AuthorizedResourceSnapshot> {
  const scope = projectionScope(ctx)
  const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, resourceIdValue)
  const catalog = new ConvexResourceCatalog(ctx.db)
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    return await createSnapshot({
      scope,
      resources: [],
      missingResourceIds: [resourceId],
      collections: [],
    })
  }

  const resource = await catalog.getResource(scope.campaignId, resourceId)
  if (!resource) {
    return await createSnapshot({
      scope,
      resources: [],
      missingResourceIds: [resourceId],
      collections: [],
    })
  }
  const spine = await visibleSpine(catalog, resource)
  return await createSnapshot({
    scope,
    resources: uniqueSummaries([...spine, resource]),
    missingResourceIds: [],
    collections: [],
  })
}

export async function loadAuthorizedCollection(
  ctx: CampaignQueryCtx,
  input: {
    query: ResourceCollectionQuery
    cursor: string | null
  },
): Promise<CollectionPage> {
  const scope = projectionScope(ctx)
  const query = normalizeResourceCollectionQuery(input.query)
  const catalog = new ConvexResourceCatalog(ctx.db)
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    return {
      snapshot: await createSnapshot({
        scope,
        resources: [],
        missingResourceIds: [],
        collections: [{ query, resourceIds: [], complete: true }],
      }),
      cursor: null,
    }
  }

  let parentSpine: ReadonlyArray<ResourceRecord> = []
  if (query.parentId !== null) {
    const parent = await catalog.getResource(scope.campaignId, query.parentId)
    if (!parent || parent.kind !== 'folder') {
      return {
        snapshot: await createSnapshot({
          scope,
          resources: [],
          missingResourceIds: [],
          collections: [{ query, resourceIds: [], complete: true }],
        }),
        cursor: null,
      }
    }
    parentSpine = [...(await visibleSpine(catalog, parent)), parent]
  }

  const page = await catalog.listChildren(
    scope.campaignId,
    query.parentId,
    query.lifecycle,
    MAX_RESOURCE_CATALOG_PAGE_SIZE,
    input.cursor,
  )
  const items =
    query.kinds === undefined
      ? page.items
      : page.items.filter((resource) => query.kinds!.includes(resource.kind))
  return {
    snapshot: await createSnapshot({
      scope,
      resources: uniqueSummaries([...parentSpine, ...items]),
      missingResourceIds: [],
      collections: [
        {
          query,
          resourceIds: items.map((resource) => resource.id),
          complete: page.cursor === null,
        },
      ],
    }),
    cursor: page.cursor,
  }
}
