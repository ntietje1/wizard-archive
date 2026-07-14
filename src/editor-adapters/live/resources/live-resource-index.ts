import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  AuthorizedResourceSnapshot,
  AuthorizedResourceSummary,
  ResourceCollectionQuery,
  ResourceProjectionScope,
} from '@wizard-archive/editor/resources/index-contract'
import {
  resourceCollectionQueryKey,
  resourceMatchesCollectionQuery,
  sameResourceProjectionScope,
} from '@wizard-archive/editor/resources/index-contract'
import {
  MutableWorkspaceResourceIndex,
  createResourceIndexLoader,
  indexRevision,
} from '@wizard-archive/editor/resources/workspace-index'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'

type LoadResourceArgs = FunctionArgs<typeof api.resources.queries.loadResource>
type LoadResourceResult = FunctionReturnType<typeof api.resources.queries.loadResource>
type LoadCollectionArgs = FunctionArgs<typeof api.resources.queries.loadCollection>
type LoadCollectionResult = FunctionReturnType<typeof api.resources.queries.loadCollection>

type LiveResourceIndexQueries = Readonly<{
  loadResource(args: LoadResourceArgs): Promise<LoadResourceResult>
  loadCollection(args: LoadCollectionArgs): Promise<LoadCollectionResult>
}>

function readSummary(value: LoadResourceResult['resources'][number]): AuthorizedResourceSummary {
  const title = canonicalizeResourceTitle(value.title)
  if (title !== value.title) throw new TypeError('Resource title is not canonical')
  return {
    id: assertDomainId(DOMAIN_ID_KIND.resource, value.id),
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, value.campaignId),
    displayParentId:
      value.displayParentId === null
        ? null
        : assertDomainId(DOMAIN_ID_KIND.resource, value.displayParentId),
    kind: value.kind,
    title,
    icon: value.icon,
    color: value.color,
    lifecycle: value.lifecycle,
    metadataVersion: assertVersionStamp(value.metadataVersion),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function readCollectionQuery(
  value: LoadResourceResult['collections'][number]['query'],
): ResourceCollectionQuery {
  return {
    parentId:
      value.parentId === null ? null : assertDomainId(DOMAIN_ID_KIND.resource, value.parentId),
    lifecycle: value.lifecycle,
    ...(value.kinds === undefined ? {} : { kinds: value.kinds }),
  }
}

function readSnapshot(value: LoadResourceResult): AuthorizedResourceSnapshot {
  return {
    scope: {
      campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, value.scope.campaignId),
      actorId: assertDomainId(DOMAIN_ID_KIND.campaignMember, value.scope.actorId),
      projection: value.scope.projection,
      schema: value.scope.schema,
    },
    revision: indexRevision(value.revision),
    resources: value.resources.map(readSummary),
    missingResourceIds: value.missingResourceIds.map((id) =>
      assertDomainId(DOMAIN_ID_KIND.resource, id),
    ),
    collections: value.collections.map((collection) => ({
      query: readCollectionQuery(collection.query),
      resourceIds: collection.resourceIds.map((id) => assertDomainId(DOMAIN_ID_KIND.resource, id)),
      complete: collection.complete,
    })),
  }
}

function combineSnapshots(
  scope: ResourceProjectionScope,
  snapshots: ReadonlyMap<
    string,
    Readonly<{ sequence: number; snapshot: AuthorizedResourceSnapshot }>
  >,
  sequence: number,
): AuthorizedResourceSnapshot {
  const resources = new Map<ResourceId, AuthorizedResourceSummary>()
  const missingResourceIds = new Set<ResourceId>()
  const collections = new Map<string, AuthorizedResourceSnapshot['collections'][number]>()

  const orderedSnapshots = Array.from(snapshots.values()).sort(
    (left, right) => left.sequence - right.sequence,
  )
  for (const { snapshot } of orderedSnapshots) {
    for (const resource of snapshot.resources) {
      resources.set(resource.id, resource)
      missingResourceIds.delete(resource.id)
    }
    for (const resourceId of snapshot.missingResourceIds) {
      resources.delete(resourceId)
      missingResourceIds.add(resourceId)
    }
    for (const collection of snapshot.collections) {
      collections.set(resourceCollectionQueryKey(collection.query), collection)
    }
  }

  return {
    scope,
    revision: indexRevision(`live-${sequence}`),
    resources: Array.from(resources.values()),
    missingResourceIds: Array.from(missingResourceIds),
    collections: Array.from(collections.values(), (collection) => {
      const resourceIds: Array<ResourceId> = []
      for (const resource of resources.values()) {
        if (resourceMatchesCollectionQuery(resource, collection.query)) {
          resourceIds.push(resource.id)
        }
      }
      return { ...collection, resourceIds: resourceIds.sort() }
    }),
  }
}

export function createLiveResourceIndexRuntime(
  scope: ResourceProjectionScope,
  queries: LiveResourceIndexQueries,
) {
  const index = new MutableWorkspaceResourceIndex(scope, indexRevision('live-empty'))
  let snapshots = new Map<
    string,
    Readonly<{ sequence: number; snapshot: AuthorizedResourceSnapshot }>
  >()
  let sequence = 0

  const apply = (key: string, rawSnapshot: LoadResourceResult) => {
    let snapshot: AuthorizedResourceSnapshot
    try {
      snapshot = readSnapshot(rawSnapshot)
    } catch {
      return { status: 'failed', retryable: false, reason: 'invalid_response' } as const
    }
    if (!sameResourceProjectionScope(scope, snapshot.scope)) {
      return { status: 'failed', retryable: false, reason: 'invalid_response' } as const
    }
    const validator = new MutableWorkspaceResourceIndex(scope, indexRevision('live-validation'))
    if (validator.replaceSnapshot(snapshot).status !== 'applied') {
      return { status: 'failed', retryable: false, reason: 'invalid_response' } as const
    }

    const nextSnapshots = new Map(snapshots)
    const nextSequence = sequence + 1
    nextSnapshots.set(key, { sequence: nextSequence, snapshot })
    const result = index.replaceSnapshot(combineSnapshots(scope, nextSnapshots, nextSequence))
    if (result.status !== 'applied' && result.status !== 'duplicate') {
      return { status: 'failed', retryable: false, reason: 'invalid_response' } as const
    }
    snapshots = nextSnapshots
    sequence = nextSequence
    return { status: 'completed' } as const
  }

  return {
    index,
    loader: createResourceIndexLoader(index, {
      loadResource: async (currentScope, resourceId) => {
        if (!sameResourceProjectionScope(scope, currentScope)) return { status: 'scope_changed' }
        const snapshot = await queries.loadResource({ campaignId: scope.campaignId, resourceId })
        return apply(`resource:${resourceId}`, snapshot)
      },
      loadCollection: async (currentScope, query) => {
        if (!sameResourceProjectionScope(scope, currentScope)) return { status: 'scope_changed' }
        const page = await queries.loadCollection({
          campaignId: scope.campaignId,
          query: {
            parentId: query.parentId,
            lifecycle: query.lifecycle,
            ...(query.kinds === undefined ? {} : { kinds: [...query.kinds] }),
          },
          cursor: null,
        })
        return apply(`collection:${resourceCollectionQueryKey(query)}`, page.snapshot)
      },
    }),
  }
}
