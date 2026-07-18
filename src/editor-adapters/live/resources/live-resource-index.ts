import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  AuthorizedResourceSnapshot,
  AuthorizedResourceSummary,
  ResourceCollectionKey,
  ResourceCollectionQuery,
  ResourceLoadResult,
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
import { resourceQueryScope } from './resource-query-scope'

type LoadResourceArgs = FunctionArgs<typeof api.resources.queries.loadResource>
type LoadResourceResult = FunctionReturnType<typeof api.resources.queries.loadResource>
type LoadCollectionArgs = FunctionArgs<typeof api.resources.queries.loadCollection>
type LoadCollectionResult = FunctionReturnType<typeof api.resources.queries.loadCollection>
type LoadAvailabilityArgs = FunctionArgs<
  typeof api.resources.queries.loadResourceProjectionAvailability
>
type StoredSnapshot = FunctionReturnType<typeof api.resources.queries.loadBookmarks>['snapshot']

type LiveResourceIndexSubscriptions = Readonly<{
  watchAvailability(args: LoadAvailabilityArgs, apply: (value: boolean) => void): () => void
  watchResource(args: LoadResourceArgs, apply: (value: LoadResourceResult) => void): () => void
  watchCollection(
    args: LoadCollectionArgs,
    apply: (value: LoadCollectionResult) => void,
  ): () => void
}>

type ProjectionSlice = Readonly<{
  sequence: number
  snapshot: AuthorizedResourceSnapshot
}>

type CollectionPage = Readonly<{
  cursor: string | null
  dispose: () => void
  slice: ProjectionSlice
}>

type CollectionSession = {
  readonly query: ResourceCollectionQuery
  readonly pages: Array<CollectionPage>
}

function activeProjectionSlices(
  resources: ReadonlyMap<ResourceId, Readonly<{ slice: ProjectionSlice }>>,
  collections: ReadonlyMap<ResourceCollectionKey, CollectionSession>,
  hydration: ReadonlyMap<ResourceId, ProjectionSlice>,
  floor: number,
): Array<ProjectionSlice> {
  const slices: Array<ProjectionSlice> = []
  for (const { slice } of resources.values()) {
    if (slice.sequence >= floor) slices.push(slice)
  }
  for (const { pages } of collections.values()) {
    for (const { slice } of pages) {
      if (slice.sequence >= floor) slices.push(slice)
    }
  }
  for (const slice of hydration.values()) {
    if (slice.sequence >= floor) slices.push(slice)
  }
  return slices.sort((left, right) => left.sequence - right.sequence)
}

function applyResourceSlices(slices: ReadonlyArray<ProjectionSlice>) {
  const resources = new Map<ResourceId, AuthorizedResourceSummary>()
  const missing = new Map<ResourceId, number>()
  for (const slice of slices) {
    for (const resource of slice.snapshot.resources) {
      if ((missing.get(resource.id) ?? -1) < slice.sequence) resources.set(resource.id, resource)
    }
    for (const resourceId of slice.snapshot.missingResourceIds) {
      missing.set(resourceId, slice.sequence)
      resources.delete(resourceId)
    }
  }
  return { resources, missing }
}

function retractUnsafeResources(
  resources: Map<ResourceId, AuthorizedResourceSummary>,
  missing: Map<ResourceId, number>,
  sequence: number,
): void {
  let retracted = true
  while (retracted) {
    retracted = false
    for (const [resourceId, resource] of resources) {
      if (resource.displayParentId !== null && !resources.has(resource.displayParentId)) {
        resources.delete(resourceId)
        missing.set(resourceId, sequence)
        retracted = true
      }
    }
  }
}

function projectResourceSlices(slices: ReadonlyArray<ProjectionSlice>, sequence: number) {
  const projection = applyResourceSlices(slices)
  retractUnsafeResources(projection.resources, projection.missing, sequence)
  return projection
}

function matchingIds(
  resources: Iterable<AuthorizedResourceSummary>,
  query: ResourceCollectionQuery,
): Array<ResourceId> {
  const resourceIds: Array<ResourceId> = []
  for (const resource of resources) {
    if (resourceMatchesCollectionQuery(resource, query)) resourceIds.push(resource.id)
  }
  return resourceIds
}

function validCollectionPage(
  snapshot: AuthorizedResourceSnapshot | null,
  key: ResourceCollectionKey,
  cursor: string | null,
): snapshot is AuthorizedResourceSnapshot {
  return (
    snapshot !== null &&
    snapshot.collections.length === 1 &&
    resourceCollectionQueryKey(snapshot.collections[0]!.query) === key &&
    snapshot.collections[0]!.complete === (cursor === null)
  )
}

function discardCollectionPages(
  collections: Map<ResourceCollectionKey, CollectionSession>,
  key: ResourceCollectionKey,
  session: CollectionSession,
  pageIndex: number,
): void {
  for (const page of session.pages.splice(pageIndex)) page.dispose()
  if (session.pages.length === 0) collections.delete(key)
}

function readSummary(value: StoredSnapshot['resources'][number]): AuthorizedResourceSummary {
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
    permission: value.permission,
    metadataVersion: assertVersionStamp(value.metadataVersion),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function readCollectionQuery(
  value: StoredSnapshot['collections'][number]['query'],
): ResourceCollectionQuery {
  return {
    parentId:
      value.parentId === null ? null : assertDomainId(DOMAIN_ID_KIND.resource, value.parentId),
    lifecycle: value.lifecycle,
    ...(value.kinds === undefined ? {} : { kinds: value.kinds }),
  }
}

function readSnapshot(value: StoredSnapshot): AuthorizedResourceSnapshot {
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
  subscriptions: LiveResourceIndexSubscriptions,
) {
  if (scope.projection === 'local') {
    throw new TypeError('A local resource projection cannot use the live index')
  }
  const projection = scope.projection
  const index = new MutableWorkspaceResourceIndex(scope, indexRevision('live-empty'))
  const resources = new Map<ResourceId, Readonly<{ dispose: () => void; slice: ProjectionSlice }>>()
  const collections = new Map<ResourceCollectionKey, CollectionSession>()
  const hydration = new Map<ResourceId, ProjectionSlice>()
  let projectionAvailable = true
  let projectionSequenceFloor = 0
  let disposeAvailability: (() => void) | null = null
  let revisionSequence = 0
  let sequence = 0

  const nextSlice = (snapshot: AuthorizedResourceSnapshot): ProjectionSlice => ({
    sequence: ++sequence,
    snapshot,
  })

  const replaceProjection = (): ResourceLoadResult => {
    const slices = projectionAvailable
      ? activeProjectionSlices(resources, collections, hydration, projectionSequenceFloor)
      : []
    const projected = projectResourceSlices(slices, sequence)
    const snapshot: AuthorizedResourceSnapshot = {
      scope,
      revision: indexRevision(`live-${++revisionSequence}`),
      resources: Array.from(projected.resources.values()),
      missingResourceIds: Array.from(projected.missing, ([resourceId]) => resourceId).filter(
        (resourceId) => !projected.resources.has(resourceId),
      ),
      collections: Array.from(collections.values(), (session) => ({
        query: session.query,
        resourceIds: matchingIds(projected.resources.values(), session.query),
        complete:
          session.pages.length > 0 && session.pages[session.pages.length - 1]!.cursor === null,
      })),
    }
    const result = index.replaceSnapshot(snapshot)
    return result.status === 'applied' || result.status === 'duplicate'
      ? ({ status: 'completed' } as const)
      : ({ status: 'failed', retryable: false, reason: 'invalid_response' } as const)
  }

  const read = (rawSnapshot: StoredSnapshot) => {
    try {
      const snapshot = readSnapshot(rawSnapshot)
      return sameResourceProjectionScope(scope, snapshot.scope) ? snapshot : null
    } catch {
      return null
    }
  }

  const loadResource = (resourceId: ResourceId) =>
    new Promise<ResourceLoadResult>((resolve) => {
      let settled = false
      let dispose: () => void = () => {}
      try {
        dispose = subscriptions.watchResource(
          {
            ...resourceQueryScope(scope),
            resourceId,
          },
          (rawSnapshot) => {
            const snapshot = read(rawSnapshot)
            if (!snapshot) {
              resources.delete(resourceId)
              replaceProjection()
              if (!settled) {
                settled = true
                dispose()
                resolve({ status: 'failed', retryable: false, reason: 'invalid_response' })
              }
              return
            }
            resources.set(resourceId, { dispose, slice: nextSlice(snapshot) })
            const result = replaceProjection()
            if (!settled) {
              settled = true
              resolve(result)
            }
          },
        )
        const current = resources.get(resourceId)
        if (current) resources.set(resourceId, { ...current, dispose })
        else if (settled) dispose()
      } catch {
        settled = true
        resolve({ status: 'failed', retryable: true, reason: 'provider_failure' })
      }
    })

  const loadCollection = (query: ResourceCollectionQuery) =>
    new Promise<ResourceLoadResult>((resolve) => {
      const key = resourceCollectionQueryKey(query)
      const session = collections.get(key) ?? { query, pages: [] }
      collections.set(key, session)
      const pageIndex = session.pages.length
      const cursor = pageIndex === 0 ? null : session.pages[pageIndex - 1]!.cursor
      let settled = false
      let dispose: () => void = () => {}
      try {
        dispose = subscriptions.watchCollection(
          {
            ...resourceQueryScope(scope),
            query: {
              parentId: query.parentId,
              lifecycle: query.lifecycle,
              ...(query.kinds === undefined ? {} : { kinds: [...query.kinds] }),
            },
            cursor,
          },
          (rawPage) => {
            const snapshot = read(rawPage.snapshot)
            if (!validCollectionPage(snapshot, key, rawPage.cursor)) {
              discardCollectionPages(collections, key, session, pageIndex)
              replaceProjection()
              if (!settled) {
                settled = true
                dispose()
                resolve({ status: 'failed', retryable: false, reason: 'invalid_response' })
              }
              return
            }
            for (const later of session.pages.splice(pageIndex + 1)) later.dispose()
            const page = {
              cursor: rawPage.cursor,
              dispose,
              slice: nextSlice(snapshot),
            }
            if (session.pages[pageIndex]) session.pages[pageIndex] = page
            else session.pages.push(page)
            const result = replaceProjection()
            if (!settled) {
              settled = true
              resolve(result)
            }
          },
        )
        const current = session.pages[pageIndex]
        if (current) session.pages[pageIndex] = { ...current, dispose }
        else if (settled) dispose()
      } catch {
        settled = true
        resolve({ status: 'failed', retryable: true, reason: 'provider_failure' })
      }
    })

  return {
    index,
    loader: createResourceIndexLoader(index, {
      loadResource: (currentScope, resourceId) => {
        if (!sameResourceProjectionScope(scope, currentScope)) {
          return Promise.resolve({ status: 'scope_changed' })
        }
        return loadResource(resourceId)
      },
      loadCollection: (currentScope, query) => {
        if (!sameResourceProjectionScope(scope, currentScope)) {
          return Promise.resolve({ status: 'scope_changed' })
        }
        return loadCollection(query)
      },
    }),
    applyProjection: (rawSnapshot: StoredSnapshot): ResourceLoadResult => {
      const snapshot = read(rawSnapshot)
      if (!snapshot) return { status: 'failed', retryable: false, reason: 'invalid_response' }
      const slice = nextSlice(snapshot)
      for (const resource of snapshot.resources) hydration.set(resource.id, slice)
      for (const resourceId of snapshot.missingResourceIds) hydration.set(resourceId, slice)
      return replaceProjection()
    },
    start: () => {
      if (disposeAvailability) return
      disposeAvailability = subscriptions.watchAvailability(
        {
          campaignId: scope.campaignId,
          actorId: scope.actorId,
          projection,
        },
        (available) => {
          if (!available) {
            projectionAvailable = false
            projectionSequenceFloor = sequence + 1
          } else {
            projectionAvailable = true
          }
          replaceProjection()
        },
      )
    },
    dispose: () => {
      disposeAvailability?.()
      disposeAvailability = null
      for (const resource of resources.values()) resource.dispose()
      for (const session of collections.values()) {
        for (const page of session.pages) page.dispose()
      }
      resources.clear()
      collections.clear()
      hydration.clear()
    },
  }
}
