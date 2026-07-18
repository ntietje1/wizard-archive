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
import { MAX_SYNCHRONOUS_RESOURCE_CLOSURE } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import { indexRevision } from '@wizard-archive/editor/resources/workspace-index'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { CampaignQueryCtx } from '../../functions'
import { ConvexResourceCatalog } from './ConvexResourceCatalog'
import { createResourceAccessResolver } from './resourceAccess'

type CollectionPage = Readonly<{
  snapshot: AuthorizedResourceSnapshot
  cursor: string | null
}>

type LoadResource = (resourceId: ResourceId) => Promise<ResourceRecord | null>
type ResourceProjectionCache = Readonly<{
  loadResource: LoadResource
  folderSpines: Map<ResourceId, ReadonlyArray<ResourceRecord>>
  access: ReturnType<typeof createResourceAccessResolver> | null
}>

function projectionScope(ctx: CampaignQueryCtx): ResourceProjectionScope {
  return {
    ...ctx.resourceScope,
    projection: ctx.membership.role === CAMPAIGN_MEMBER_ROLE.DM ? 'dm' : 'player',
    schema: RESOURCE_INDEX_SCHEMA,
  }
}

async function visibleSpine(
  cache: ResourceProjectionCache,
  resource: ResourceRecord,
): Promise<ReadonlyArray<ResourceRecord>> {
  const cached = cache.folderSpines.get(resource.id)
  if (cached) return cached
  const path = [resource]
  const visited = new Set<ResourceId>([resource.id])
  let parentId = resource.parentId
  while (parentId !== null) {
    if (visited.has(parentId)) throw new Error('Resource hierarchy contains a cycle')
    visited.add(parentId)
    if (visited.size > MAX_SYNCHRONOUS_RESOURCE_CLOSURE) {
      throw new Error('Resource hierarchy exceeds its bound')
    }
    const parent = await cache.loadResource(parentId)
    if (!parent || parent.kind !== 'folder') {
      throw new Error('Resource hierarchy contains an invalid parent')
    }
    const parentSpine = cache.folderSpines.get(parent.id)
    if (parentSpine) return cacheSpines(cache, path, [...parentSpine, parent])
    path.push(parent)
    parentId = parent.parentId
  }
  return cacheSpines(cache, path, [])
}

function cacheSpines(
  cache: ResourceProjectionCache,
  path: ReadonlyArray<ResourceRecord>,
  base: ReadonlyArray<ResourceRecord>,
): ReadonlyArray<ResourceRecord> {
  let ancestors = base
  let result = base
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const resource = path[index]!
    result = ancestors
    if (resource.kind === 'folder') cache.folderSpines.set(resource.id, ancestors)
    ancestors = [...ancestors, resource]
  }
  return result
}

async function uniqueSummaries(
  cache: ResourceProjectionCache,
  loadResource: LoadResource,
  resources: ReadonlyArray<ResourceRecord>,
): Promise<ReadonlyArray<AuthorizedResourceSummary>> {
  const summaries = new Map<ResourceId, AuthorizedResourceSummary>()
  const projected = await Promise.all(
    resources.map(async (resource) => {
      const parent =
        resource.lifecycle.state === 'trashed' && resource.parentId !== null
          ? await loadResource(resource.parentId)
          : null
      const displayParentId =
        resource.lifecycle.state === 'trashed' && parent?.lifecycle.state !== 'trashed'
          ? null
          : resource.parentId
      const permission = cache.access === null ? 'edit' : await cache.access.permission(resource)
      if (permission === 'none') {
        throw new TypeError('Authorized projection contains an unauthorized resource')
      }
      return authorizedResourceSummaryFromRecord(resource, permission, displayParentId)
    }),
  )
  for (const summary of projected) {
    summaries.set(summary.id, summary)
  }
  return Array.from(summaries.values()).sort((left, right) => compareText(left.id, right.id))
}

function createResourceProjectionCache(
  ctx: CampaignQueryCtx,
  catalog: ConvexResourceCatalog,
  campaignId: ResourceRecord['campaignId'],
): ResourceProjectionCache {
  const resources = new Map<ResourceId, Promise<ResourceRecord | null>>()
  const loadResource: LoadResource = (resourceId) => {
    const cached = resources.get(resourceId)
    if (cached) return cached
    const pending = catalog.getResource(campaignId, resourceId)
    resources.set(resourceId, pending)
    return pending
  }
  return {
    loadResource,
    folderSpines: new Map(),
    access:
      ctx.membership.role === CAMPAIGN_MEMBER_ROLE.DM
        ? null
        : createResourceAccessResolver(ctx, campaignId, ctx.resourceScope.actorId, loadResource),
  }
}

async function canProject(
  cache: ResourceProjectionCache,
  resource: ResourceRecord,
): Promise<boolean> {
  return (
    cache.access === null ||
    (resource.lifecycle.state === 'active' && (await cache.access.canProject(resource)))
  )
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
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
  const cache = createResourceProjectionCache(ctx, catalog, scope.campaignId)
  const resource = await cache.loadResource(resourceId)
  if (!resource || !(await canProject(cache, resource))) {
    return await createSnapshot({
      scope,
      resources: [],
      missingResourceIds: [resourceId],
      collections: [],
    })
  }
  const spine = await visibleSpine(cache, resource)
  return await createSnapshot({
    scope,
    resources: await uniqueSummaries(cache, cache.loadResource, [...spine, resource]),
    missingResourceIds: [],
    collections: [],
  })
}

export async function loadAuthorizedResourceProjection(
  ctx: CampaignQueryCtx,
  resourceIds: ReadonlyArray<ResourceId>,
): Promise<AuthorizedResourceSnapshot> {
  const scope = projectionScope(ctx)
  const uniqueIds = Array.from(new Set(resourceIds))
  const catalog = new ConvexResourceCatalog(ctx.db)
  const cache = createResourceProjectionCache(ctx, catalog, scope.campaignId)
  const resources = new Map(
    (
      await Promise.all(
        uniqueIds.map(async (resourceId) => {
          const resource = await cache.loadResource(resourceId)
          return resource && (await canProject(cache, resource)) ? resource : null
        }),
      )
    ).flatMap((resource) => (resource === null ? [] : [[resource.id, resource] as const])),
  )
  const projected: Array<ResourceRecord> = []
  for (const resource of resources.values()) {
    projected.push(...(await visibleSpine(cache, resource)), resource)
  }
  return await createSnapshot({
    scope,
    resources: await uniqueSummaries(cache, cache.loadResource, projected),
    missingResourceIds: uniqueIds.filter((resourceId) => !resources.has(resourceId)),
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
  const cache = createResourceProjectionCache(ctx, catalog, scope.campaignId)

  let parentSpine: ReadonlyArray<ResourceRecord> = []
  if (query.parentId !== null) {
    const parent = await cache.loadResource(query.parentId)
    if (!parent || parent.kind !== 'folder' || !(await canProject(cache, parent))) {
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
    parentSpine = [...(await visibleSpine(cache, parent)), parent]
  }

  const page = await catalog.listCollection(
    scope.campaignId,
    query,
    MAX_RESOURCE_CATALOG_PAGE_SIZE,
    input.cursor,
  )
  const items = (
    await Promise.all(
      page.items.map(async (resource) => ((await canProject(cache, resource)) ? resource : null)),
    )
  ).flatMap((resource) => (resource ? [resource] : []))
  return {
    snapshot: await createSnapshot({
      scope,
      resources: await uniqueSummaries(cache, cache.loadResource, [...parentSpine, ...items]),
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
