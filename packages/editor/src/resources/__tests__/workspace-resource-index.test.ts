import { describe, expect, it, vi } from 'vite-plus/test'
import { assertSha256Digest, initialVersion } from '../component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  DomainIdByKind,
  DomainIdKind,
  ResourceId,
} from '../domain-id'
import type {
  AuthorizedResourceSnapshot,
  AuthorizedResourceSummary,
  ResourceCollectionQuery,
  ResourceLoadResult,
  ResourceProjectionScope,
} from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import {
  MutableWorkspaceResourceIndex,
  createResourceIndexLoader,
  indexRevision,
  sortAuthorizedResourceSummaries,
} from '../workspace-resource-index'

const campaignId = id(DOMAIN_ID_KIND.campaign, 1)
const actorId = id(DOMAIN_ID_KIND.campaignMember, 2)
const rootId = id(DOMAIN_ID_KIND.resource, 10)
const childId = id(DOMAIN_ID_KIND.resource, 11)
const missingId = id(DOMAIN_ID_KIND.resource, 12)
const unknownId = id(DOMAIN_ID_KIND.resource, 13)
const version = initialVersion(assertSha256Digest('a'.repeat(64)))
const scope = projectionScope(campaignId, actorId, 'player', 'resource-index-v1')

function id<TKind extends DomainIdKind>(kind: TKind, sequence: number): DomainIdByKind[TKind] {
  return assertDomainId(kind, `01890f47-f6c8-7a5b-8c9d-${sequence.toString(16).padStart(12, '0')}`)
}

function projectionScope(
  campaign: CampaignId,
  actor: CampaignMemberId,
  projection: string,
  schema: string,
): ResourceProjectionScope {
  return { campaignId: campaign, actorId: actor, projection, schema }
}

function summary(
  resourceId: ResourceId,
  input: Partial<AuthorizedResourceSummary> = {},
): AuthorizedResourceSummary {
  return {
    id: resourceId,
    campaignId,
    displayParentId: null,
    kind: 'note',
    title: canonicalizeResourceTitle('Entry'),
    icon: null,
    color: null,
    lifecycle: 'active',
    metadataVersion: version,
    createdAt: 1,
    updatedAt: 2,
    ...input,
  }
}

function authorizedSnapshot(
  input: Partial<AuthorizedResourceSnapshot> = {},
): AuthorizedResourceSnapshot {
  return {
    scope,
    revision: indexRevision('revision-1'),
    resources: [summary(rootId, { kind: 'folder', title: canonicalizeResourceTitle('Root') })],
    missingResourceIds: [missingId],
    collections: [],
    ...input,
  }
}

describe('MutableWorkspaceResourceIndex', () => {
  it('distinguishes known, missing, and unknown resources and preserves complete visible spines', () => {
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
    const initial = index.getSnapshot()
    expect(initial.lookup(rootId)).toEqual({ state: 'unknown' })
    expect(index.getSnapshot()).toBe(initial)

    expect(
      index.replaceSnapshot(
        authorizedSnapshot({
          resources: [
            summary(rootId, { kind: 'folder', title: canonicalizeResourceTitle('Root') }),
            summary(childId, { displayParentId: rootId }),
          ],
        }),
      ),
    ).toEqual({ status: 'applied' })
    expect(index.getSnapshot().lookup(childId)).toEqual({
      state: 'known',
      value: expect.objectContaining({ id: childId, displayParentId: rootId }),
    })
    expect(index.getSnapshot().lookup(missingId)).toEqual({ state: 'missing' })
    expect(index.getSnapshot().lookup(unknownId)).toEqual({ state: 'unknown' })
    expect(index.getSnapshot().ancestors(childId)).toEqual({
      state: 'known',
      value: [expect.objectContaining({ id: rootId })],
    })
    expect(index.getSnapshot().ancestors(missingId)).toEqual({ state: 'missing' })
    expect(index.getSnapshot().lookup(childId)).not.toHaveProperty('value.canonicalParentId')

    expect(
      index.replaceSnapshot(
        authorizedSnapshot({
          revision: indexRevision('revision-2'),
          resources: [summary(childId, { displayParentId: rootId })],
        }),
      ),
    ).toEqual({ status: 'replacement_required', reason: 'invalid_projection' })
    expect(index.getSnapshot().lookup(childId).state).toBe('known')
  })

  it('projects only safe summary fields from provider objects', () => {
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
    const providerResource = {
      ...summary(rootId, { kind: 'folder' }),
      canonicalParentId: unknownId,
      effectiveAccess: 'edit',
      bookmarked: true,
    }
    expect(index.replaceSnapshot(authorizedSnapshot({ resources: [providerResource] }))).toEqual({
      status: 'applied',
    })
    const knowledge = index.getSnapshot().lookup(rootId)
    expect(knowledge).not.toHaveProperty('value.canonicalParentId')
    expect(knowledge).not.toHaveProperty('value.effectiveAccess')
    expect(knowledge).not.toHaveProperty('value.bookmarked')
  })

  it('uses one normalized query model for complete, incomplete, empty, and unknown collections', () => {
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
    const roots: ResourceCollectionQuery = {
      parentId: null,
      lifecycle: 'active',
      kinds: ['note', 'folder', 'note'],
    }
    const trash: ResourceCollectionQuery = { parentId: null, lifecycle: 'trashed' }
    const children: ResourceCollectionQuery = { parentId: rootId, lifecycle: 'active' }
    expect(
      index.replaceSnapshot(
        authorizedSnapshot({
          resources: [
            summary(rootId, { kind: 'folder' }),
            summary(childId, { displayParentId: rootId }),
          ],
          collections: [
            { query: roots, resourceIds: [rootId], complete: false },
            { query: trash, resourceIds: [], complete: true },
            { query: children, resourceIds: [childId], complete: true },
          ],
        }),
      ),
    ).toEqual({ status: 'applied' })

    expect(
      index.getSnapshot().list({
        parentId: null,
        lifecycle: 'active',
        kinds: ['folder', 'note'],
      }),
    ).toEqual({
      state: 'known',
      items: [expect.objectContaining({ id: rootId })],
      complete: false,
    })
    expect(index.getSnapshot().list(trash)).toEqual({ state: 'known', items: [], complete: true })
    expect(index.getSnapshot().list(children).state).toBe('known')
    expect(
      index.getSnapshot().list({ parentId: null, lifecycle: 'active', kinds: ['map'] }),
    ).toEqual({ state: 'unknown' })
  })

  it('applies only matching-base actor-safe changes and treats exact redelivery as a no-op', () => {
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
    index.replaceSnapshot(
      authorizedSnapshot({
        resources: [
          summary(rootId, { kind: 'folder' }),
          summary(childId, { displayParentId: rootId }),
        ],
        collections: [
          {
            query: { parentId: rootId, lifecycle: 'active' },
            resourceIds: [childId],
            complete: true,
          },
        ],
      }),
    )
    const listener = vi.fn()
    index.subscribe(listener)
    const changeSet = {
      scope,
      baseRevision: indexRevision('revision-1'),
      nextRevision: indexRevision('revision-2'),
      changes: [
        {
          type: 'upsert' as const,
          resource: summary(childId, {
            displayParentId: rootId,
            title: canonicalizeResourceTitle('Updated'),
          }),
        },
      ],
    }

    expect(index.applyChangeSet(changeSet)).toEqual({ status: 'applied' })
    expect(index.getSnapshot().lookup(childId)).toEqual({
      state: 'known',
      value: expect.objectContaining({ title: 'Updated' }),
    })
    expect(index.applyChangeSet({ ...changeSet, changes: [...changeSet.changes] })).toEqual({
      status: 'duplicate',
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(
      index.applyChangeSet({
        ...changeSet,
        baseRevision: indexRevision('stale'),
        nextRevision: indexRevision('revision-3'),
      }),
    ).toEqual({ status: 'replacement_required', reason: 'revision_mismatch' })

    expect(
      index.applyChangeSet({
        scope,
        baseRevision: indexRevision('revision-2'),
        nextRevision: indexRevision('revision-3'),
        changes: [{ type: 'remove', resourceId: rootId }],
      }),
    ).toEqual({ status: 'replacement_required', reason: 'invalid_projection' })
    expect(index.getSnapshot().lookup(rootId).state).toBe('known')
  })

  it('reconciles collection membership and neutral missing knowledge from change sets', () => {
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
    index.replaceSnapshot(
      authorizedSnapshot({
        resources: [summary(rootId, { kind: 'folder' })],
        collections: [
          {
            query: { parentId: rootId, lifecycle: 'active', kinds: ['note'] },
            resourceIds: [],
            complete: true,
          },
        ],
      }),
    )
    expect(
      index.applyChangeSet({
        scope,
        baseRevision: indexRevision('revision-1'),
        nextRevision: indexRevision('revision-2'),
        changes: [{ type: 'upsert', resource: summary(childId, { displayParentId: rootId }) }],
      }),
    ).toEqual({ status: 'applied' })
    expect(
      index.getSnapshot().list({ parentId: rootId, lifecycle: 'active', kinds: ['note'] }),
    ).toEqual({
      state: 'known',
      items: [expect.objectContaining({ id: childId })],
      complete: true,
    })
    expect(
      index.applyChangeSet({
        scope,
        baseRevision: indexRevision('revision-2'),
        nextRevision: indexRevision('revision-3'),
        changes: [{ type: 'remove', resourceId: childId }],
      }),
    ).toEqual({ status: 'applied' })
    expect(index.getSnapshot().lookup(childId)).toEqual({ state: 'missing' })
    expect(
      index.applyChangeSet({
        scope,
        baseRevision: indexRevision('revision-1'),
        nextRevision: indexRevision('revision-2'),
        changes: [{ type: 'upsert', resource: summary(childId, { displayParentId: rootId }) }],
      }),
    ).toEqual({ status: 'duplicate' })
    expect(
      index.getSnapshot().list({ parentId: rootId, lifecycle: 'active', kinds: ['note'] }),
    ).toEqual({ state: 'known', items: [], complete: true })
  })

  it('requires replacement for wrong scope and synchronously clears every scope transition', () => {
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
    index.replaceSnapshot(authorizedSnapshot())
    const listener = vi.fn()
    index.subscribe(listener)
    const transitions = [
      projectionScope(id(DOMAIN_ID_KIND.campaign, 20), actorId, 'player', 'resource-index-v1'),
      projectionScope(
        campaignId,
        id(DOMAIN_ID_KIND.campaignMember, 21),
        'player',
        'resource-index-v1',
      ),
      projectionScope(campaignId, actorId, 'view-as-gm', 'resource-index-v1'),
      projectionScope(campaignId, actorId, 'player-permissions-v2', 'resource-index-v1'),
      projectionScope(campaignId, actorId, 'player', 'resource-index-v2'),
    ]

    for (const [position, nextScope] of transitions.entries()) {
      index.replaceScope(nextScope, indexRevision(`scope-${position}`))
      expect(index.getSnapshot().scope).toEqual(nextScope)
      expect(index.getSnapshot().lookup(rootId)).toEqual({ state: 'unknown' })
    }
    expect(listener).toHaveBeenCalledTimes(transitions.length)
    expect(index.replaceSnapshot(authorizedSnapshot())).toEqual({
      status: 'replacement_required',
      reason: 'wrong_scope',
    })
  })

  it('rejects conflicting same-revision snapshots and ignores exact snapshot duplicates', () => {
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
    const snapshot = authorizedSnapshot()
    expect(index.replaceSnapshot(snapshot)).toEqual({ status: 'applied' })
    const current = index.getSnapshot()
    expect(index.replaceSnapshot({ ...snapshot, resources: [...snapshot.resources] })).toEqual({
      status: 'duplicate',
    })
    expect(index.getSnapshot()).toBe(current)
    expect(
      index.replaceSnapshot({
        ...snapshot,
        resources: [
          summary(rootId, { kind: 'folder', title: canonicalizeResourceTitle('Changed') }),
        ],
      }),
    ).toEqual({ status: 'replacement_required', reason: 'invalid_projection' })
  })
})

describe('ResourceIndexLoader', () => {
  it('normalizes collection identity and verifies completed resource and collection postconditions', async () => {
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
    let loadedQuery: ResourceCollectionQuery | null = null
    const loader = createResourceIndexLoader(index, {
      loadResource: (_scope, resourceId) => {
        index.replaceSnapshot(
          authorizedSnapshot({
            missingResourceIds: [resourceId],
            resources: [],
          }),
        )
        return Promise.resolve({ status: 'completed' })
      },
      loadCollection: (_scope, query) => {
        loadedQuery = query
        index.replaceSnapshot(
          authorizedSnapshot({
            revision: indexRevision('revision-2'),
            resources: [],
            missingResourceIds: [missingId],
            collections: [{ query, resourceIds: [], complete: true }],
          }),
        )
        return Promise.resolve({ status: 'completed' })
      },
    })

    await expect(loader.ensureResource(missingId)).resolves.toEqual({ status: 'completed' })
    await expect(
      loader.ensureCollection({
        parentId: null,
        lifecycle: 'active',
        kinds: ['note', 'folder', 'note'],
      }),
    ).resolves.toEqual({ status: 'completed' })
    expect(loadedQuery).toEqual({
      parentId: null,
      lifecycle: 'active',
      kinds: ['folder', 'note'],
    })
  })

  it('normalizes provider failures, rejects false completion, and detects scope changes', async () => {
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
    const incomplete = createResourceIndexLoader(index, {
      loadResource: () => Promise.resolve({ status: 'completed' }),
      loadCollection: () => Promise.resolve({ status: 'completed' }),
    })
    await expect(incomplete.ensureResource(unknownId)).resolves.toEqual({
      status: 'failed',
      retryable: false,
      reason: 'invalid_response',
    })
    await expect(
      incomplete.ensureCollection({ parentId: null, lifecycle: 'active' }),
    ).resolves.toEqual({ status: 'failed', retryable: false, reason: 'invalid_response' })
    await expect(
      incomplete.ensureCollection({
        parentId: null,
        lifecycle: 'active',
        kinds: ['search' as 'note'],
      }),
    ).resolves.toEqual({ status: 'failed', retryable: false, reason: 'invalid_response' })

    const failure = createResourceIndexLoader(index, {
      loadResource: () => Promise.reject(new Error('provider failed')),
      loadCollection: () => Promise.resolve({ status: 'mystery' } as unknown as ResourceLoadResult),
    })
    await expect(failure.ensureResource(unknownId)).resolves.toEqual({
      status: 'failed',
      retryable: true,
      reason: 'provider_failure',
    })
    await expect(
      failure.ensureCollection({ parentId: null, lifecycle: 'active' }),
    ).resolves.toEqual({ status: 'failed', retryable: false, reason: 'invalid_response' })

    const scopeChanging = createResourceIndexLoader(index, {
      loadResource: () => {
        index.replaceScope(
          projectionScope(campaignId, actorId, 'new-permissions', 'resource-index-v1'),
          indexRevision('new-scope'),
        )
        return Promise.resolve({ status: 'completed' })
      },
      loadCollection: () => Promise.resolve({ status: 'unavailable', reason: 'scope_unavailable' }),
    })
    await expect(scopeChanging.ensureResource(unknownId)).resolves.toEqual({
      status: 'scope_changed',
    })
    await expect(
      scopeChanging.ensureCollection({ parentId: null, lifecycle: 'active' }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'scope_unavailable' })
  })
})

describe('authorized resource sorting', () => {
  it('sorts loaded summaries by safe fields with UUID as the final tie-breaker', () => {
    const firstId = id(DOMAIN_ID_KIND.resource, 30)
    const secondId = id(DOMAIN_ID_KIND.resource, 31)
    const entries = [
      summary(secondId, {
        title: canonicalizeResourceTitle('Entry 2'),
        createdAt: 1,
        updatedAt: 3,
      }),
      summary(firstId, {
        title: canonicalizeResourceTitle('Entry 2'),
        createdAt: 1,
        updatedAt: 2,
      }),
      summary(rootId, {
        title: canonicalizeResourceTitle('Entry 10'),
        createdAt: 2,
        updatedAt: 1,
      }),
    ]

    expect(
      sortAuthorizedResourceSummaries(entries, 'title', 'ascending').map((entry) => entry.id),
    ).toEqual([firstId, secondId, rootId])
    expect(
      sortAuthorizedResourceSummaries(entries, 'created', 'descending').map((entry) => entry.id),
    ).toEqual([rootId, firstId, secondId])
    expect(
      sortAuthorizedResourceSummaries(entries, 'updated', 'ascending').map((entry) => entry.id),
    ).toEqual([rootId, firstId, secondId])
    expect(entries[0]?.id).toBe(secondId)
  })
})
