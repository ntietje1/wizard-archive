import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  AuthorizedResourceSnapshot,
  AuthorizedResourceSummary,
  ResourceCollectionKey,
  ResourceCollectionQuery,
  ResourceProjectionScope,
} from '@wizard-archive/editor/resources/index-contract'
import {
  resourceCollectionQueryKey,
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

export function createLiveResourceIndexRuntime(
  scope: ResourceProjectionScope,
  queries: LiveResourceIndexQueries,
) {
  const index = new MutableWorkspaceResourceIndex(scope, indexRevision('live-empty'))
  const collectionCursors = new Map<ResourceCollectionKey, string | null>()
  let sequence = 0

  const applySnapshot = (snapshot: AuthorizedResourceSnapshot) => {
    const nextSequence = sequence + 1
    const result = index.applyProjectionSnapshot(snapshot, indexRevision(`live-${nextSequence}`))
    if (result.status !== 'applied' && result.status !== 'duplicate') {
      return { status: 'failed', retryable: false, reason: 'invalid_response' } as const
    }
    if (result.status === 'applied') sequence = nextSequence
    return { status: 'completed' } as const
  }

  const apply = (rawSnapshot: LoadResourceResult) => {
    try {
      return applySnapshot(readSnapshot(rawSnapshot))
    } catch {
      return { status: 'failed', retryable: false, reason: 'invalid_response' } as const
    }
  }

  return {
    index,
    loader: createResourceIndexLoader(index, {
      loadResource: async (currentScope, resourceId) => {
        if (!sameResourceProjectionScope(scope, currentScope)) return { status: 'scope_changed' }
        const snapshot = await queries.loadResource({ campaignId: scope.campaignId, resourceId })
        return apply(snapshot)
      },
      loadCollection: async (currentScope, query) => {
        if (!sameResourceProjectionScope(scope, currentScope)) return { status: 'scope_changed' }
        const key = resourceCollectionQueryKey(query)
        const page = await queries.loadCollection({
          campaignId: scope.campaignId,
          query: {
            parentId: query.parentId,
            lifecycle: query.lifecycle,
            ...(query.kinds === undefined ? {} : { kinds: [...query.kinds] }),
          },
          cursor: collectionCursors.get(key) ?? null,
        })
        let snapshot: AuthorizedResourceSnapshot
        try {
          snapshot = readSnapshot(page.snapshot)
        } catch {
          return { status: 'failed', retryable: false, reason: 'invalid_response' }
        }
        if (
          snapshot.collections.length !== 1 ||
          resourceCollectionQueryKey(snapshot.collections[0]!.query) !== key ||
          snapshot.collections[0]!.complete !== (page.cursor === null)
        ) {
          return { status: 'failed', retryable: false, reason: 'invalid_response' }
        }
        const result = applySnapshot(snapshot)
        if (result.status === 'completed') {
          if (page.cursor === null) collectionCursors.delete(key)
          else collectionCursors.set(key, page.cursor)
        }
        return result
      },
    }),
    applyProjection: (snapshot: LoadResourceResult) => apply(snapshot),
  }
}
