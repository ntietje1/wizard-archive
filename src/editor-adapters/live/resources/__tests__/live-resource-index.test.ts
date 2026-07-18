import { describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'
import { createLiveResourceIndexRuntime } from '../live-resource-index'

const scope = {
  campaignId: testDomainId('campaign', 'live-index'),
  actorId: testDomainId('campaignMember', 'live-index'),
  projection: 'dm',
  schema: RESOURCE_INDEX_SCHEMA,
} satisfies ResourceProjectionScope
const version = {
  scheme: 'authoritative-revision-v1' as const,
  revision: 1,
  digest: '0'.repeat(64),
}

function resource(
  id: ResourceId,
  parentId: ResourceId | null = null,
  permission: 'edit' | 'view' = 'edit',
) {
  return {
    id,
    campaignId: scope.campaignId,
    displayParentId: parentId,
    kind: parentId === null ? ('folder' as const) : ('note' as const),
    title: parentId === null ? 'Lore' : 'Session Notes',
    icon: null,
    color: null,
    lifecycle: 'active' as const,
    permission,
    metadataVersion: version,
    createdAt: 1,
    updatedAt: 1,
  }
}

function snapshot(
  resources: Array<ReturnType<typeof resource>>,
  input: {
    missingResourceIds?: Array<ResourceId>
    collections?: Array<{
      query: { parentId: ResourceId | null; lifecycle: 'active' | 'trashed' }
      resourceIds: Array<ResourceId>
      complete: boolean
    }>
    scopeOverride?: Partial<Omit<ResourceProjectionScope, 'projection' | 'schema'>> & {
      projection?: Exclude<ResourceProjectionScope['projection'], 'local'>
      schema?: typeof RESOURCE_INDEX_SCHEMA
    }
  } = {},
) {
  return {
    scope: { ...scope, ...input.scopeOverride },
    revision: `server-${resources.length}-${input.missingResourceIds?.length ?? 0}`,
    resources,
    missingResourceIds: input.missingResourceIds ?? [],
    collections: input.collections ?? [],
  }
}

function subscribedQueries(
  loadResource: (args: {
    campaignId: string
    resourceId: string
    viewAsParticipantId?: string
  }) => Promise<ReturnType<typeof snapshot>>,
  loadCollection: (args: {
    campaignId: string
    query: { parentId: string | null; lifecycle: 'active' | 'trashed' }
    cursor?: string | null
    viewAsParticipantId?: string
  }) => Promise<{
    snapshot: ReturnType<typeof snapshot>
    cursor: string | null
  }>,
) {
  return {
    watchAvailability: (_args: unknown, apply: (value: boolean) => void) => {
      apply(true)
      return vi.fn()
    },
    watchResource: (
      args: Parameters<typeof loadResource>[0],
      apply: (value: ReturnType<typeof snapshot>) => void,
    ) => {
      void loadResource(args).then(apply)
      return vi.fn()
    },
    watchCollection: (
      args: Parameters<typeof loadCollection>[0],
      apply: (value: Awaited<ReturnType<typeof loadCollection>>) => void,
    ) => {
      void loadCollection(args).then(apply)
      return vi.fn()
    },
  }
}

describe('createLiveResourceIndexRuntime', () => {
  it('loads exact resource knowledge with its ancestor spine', async () => {
    const folderId = testDomainId('resource', 'folder')
    const noteId = testDomainId('resource', 'note')
    const loadResource = vi.fn(() =>
      Promise.resolve(snapshot([resource(folderId), resource(noteId, folderId)])),
    )
    const runtime = createLiveResourceIndexRuntime(scope, subscribedQueries(loadResource, vi.fn()))

    await expect(runtime.loader.ensureResource(noteId)).resolves.toEqual({ status: 'completed' })
    expect(runtime.index.getSnapshot().lookup(noteId)).toMatchObject({
      state: 'known',
      value: { id: noteId, displayParentId: folderId },
    })
    expect(runtime.index.getSnapshot().ancestors(noteId)).toMatchObject({
      state: 'known',
      value: [{ id: folderId }],
    })
    expect(loadResource).toHaveBeenCalledWith({ campaignId: scope.campaignId, resourceId: noteId })
  })

  it('includes the selected participant in every view-as projection request', async () => {
    const resourceId = testDomainId('resource', 'view-as-resource')
    const actorId = testDomainId('campaignMember', 'view-as-actor')
    const viewAsScope = {
      ...scope,
      actorId,
      projection: 'view_as_player',
    } satisfies ResourceProjectionScope
    const loadResource = vi.fn(() =>
      Promise.resolve(
        snapshot([resource(resourceId)], {
          scopeOverride: { actorId, projection: 'view_as_player' },
        }),
      ),
    )
    const runtime = createLiveResourceIndexRuntime(
      viewAsScope,
      subscribedQueries(loadResource, vi.fn()),
    )

    await expect(runtime.loader.ensureResource(resourceId)).resolves.toEqual({
      status: 'completed',
    })
    expect(loadResource).toHaveBeenCalledWith({
      campaignId: scope.campaignId,
      viewAsParticipantId: actorId,
      resourceId,
    })
  })

  it('retains prior knowledge while loading a collection', async () => {
    const knownId = testDomainId('resource', 'known')
    const rootId = testDomainId('resource', 'root')
    const query = { parentId: null, lifecycle: 'active' as const }
    const runtime = createLiveResourceIndexRuntime(
      scope,
      subscribedQueries(
        vi.fn(() => Promise.resolve(snapshot([resource(knownId)]))),
        vi.fn(() =>
          Promise.resolve({
            snapshot: snapshot([resource(rootId)], {
              collections: [{ query, resourceIds: [rootId], complete: true }],
            }),
            cursor: null,
          }),
        ),
      ),
    )

    await runtime.loader.ensureResource(knownId)
    await expect(runtime.loader.ensureCollection(query)).resolves.toEqual({ status: 'completed' })

    expect(runtime.index.getSnapshot().lookup(knownId).state).toBe('known')
    expect(runtime.index.getSnapshot().list(query)).toMatchObject({
      state: 'known',
      complete: true,
      items: expect.arrayContaining([
        expect.objectContaining({ id: knownId }),
        expect.objectContaining({ id: rootId }),
      ]),
    })
  })

  it('applies an authoritative missing projection without treating ensure as refresh', async () => {
    const resourceId = testDomainId('resource', 'deleted')
    const query = { parentId: null, lifecycle: 'active' as const }
    const loadResource = vi.fn().mockResolvedValue(snapshot([resource(resourceId)]))
    const runtime = createLiveResourceIndexRuntime(
      scope,
      subscribedQueries(
        loadResource,
        vi.fn(() =>
          Promise.resolve({
            snapshot: snapshot([resource(resourceId)], {
              collections: [{ query, resourceIds: [resourceId], complete: true }],
            }),
            cursor: null,
          }),
        ),
      ),
    )

    await runtime.loader.ensureResource(resourceId)
    await runtime.loader.ensureCollection(query)
    await runtime.loader.ensureResource(resourceId)
    expect(loadResource).toHaveBeenCalledOnce()
    const listener = vi.fn()
    runtime.index.subscribe(listener)
    expect(runtime.applyProjection(snapshot([], { missingResourceIds: [resourceId] }))).toEqual({
      status: 'completed',
    })

    expect(runtime.index.getSnapshot().lookup(resourceId)).toEqual({ state: 'missing' })
    expect(runtime.index.getSnapshot().list(query)).toMatchObject({
      state: 'known',
      items: [],
      complete: true,
    })
    expect(listener).toHaveBeenCalledOnce()
  })

  it('deduplicates concurrent collection loads and advances the saved cursor until complete', async () => {
    const firstId = testDomainId('resource', 'page-one')
    const secondId = testDomainId('resource', 'page-two')
    const query = { parentId: null, lifecycle: 'active' as const }
    const loadCollection = vi
      .fn()
      .mockResolvedValueOnce({
        snapshot: snapshot([resource(firstId)], {
          collections: [{ query, resourceIds: [firstId], complete: false }],
        }),
        cursor: 'cursor-1',
      })
      .mockResolvedValueOnce({
        snapshot: snapshot([resource(secondId)], {
          collections: [{ query, resourceIds: [secondId], complete: true }],
        }),
        cursor: null,
      })
    const runtime = createLiveResourceIndexRuntime(
      scope,
      subscribedQueries(vi.fn(), loadCollection),
    )

    const firstLoads = await Promise.all([
      runtime.loader.ensureCollection(query),
      runtime.loader.ensureCollection({ ...query }),
    ])

    expect(firstLoads).toEqual([{ status: 'completed' }, { status: 'completed' }])
    expect(loadCollection).toHaveBeenCalledOnce()
    expect(loadCollection).toHaveBeenLastCalledWith({
      campaignId: scope.campaignId,
      query,
      cursor: null,
    })
    expect(runtime.index.getSnapshot().list(query)).toMatchObject({
      state: 'known',
      items: [expect.objectContaining({ id: firstId })],
      complete: false,
    })

    await expect(runtime.loader.ensureCollection(query)).resolves.toEqual({ status: 'completed' })
    expect(loadCollection).toHaveBeenCalledTimes(2)
    expect(loadCollection).toHaveBeenLastCalledWith({
      campaignId: scope.campaignId,
      query,
      cursor: 'cursor-1',
    })
    expect(runtime.index.getSnapshot().list(query)).toMatchObject({
      state: 'known',
      items: expect.arrayContaining([
        expect.objectContaining({ id: firstId }),
        expect.objectContaining({ id: secondId }),
      ]),
      complete: true,
    })

    await expect(runtime.loader.ensureCollection(query)).resolves.toEqual({ status: 'completed' })
    expect(loadCollection).toHaveBeenCalledTimes(2)
  })

  it('reacts to permission changes, revocation, regrant, and runtime disposal', async () => {
    const resourceId = testDomainId('resource', 'reactive-resource')
    const dispose = vi.fn()
    let applyResource: ((value: ReturnType<typeof snapshot>) => void) | undefined
    const runtime = createLiveResourceIndexRuntime(scope, {
      watchAvailability: vi.fn(),
      watchResource: (_args, apply) => {
        applyResource = apply
        apply(snapshot([resource(resourceId)]))
        return dispose
      },
      watchCollection: vi.fn(),
    })

    await expect(runtime.loader.ensureResource(resourceId)).resolves.toEqual({
      status: 'completed',
    })
    expect(runtime.index.getSnapshot().lookup(resourceId)).toMatchObject({
      state: 'known',
      value: { permission: 'edit' },
    })

    applyResource?.(snapshot([{ ...resource(resourceId, null, 'view'), title: 'Renamed' }]))
    expect(runtime.index.getSnapshot().lookup(resourceId)).toMatchObject({
      state: 'known',
      value: { permission: 'view', title: 'Renamed' },
    })

    applyResource?.(snapshot([], { missingResourceIds: [resourceId] }))
    expect(runtime.index.getSnapshot().lookup(resourceId)).toEqual({ state: 'missing' })

    applyResource?.(snapshot([resource(resourceId)]))
    expect(runtime.index.getSnapshot().lookup(resourceId)).toMatchObject({
      state: 'known',
      value: { permission: 'edit' },
    })

    runtime.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('clears membership-scoped knowledge and requires a fresh projection after reacceptance', async () => {
    const resourceId = testDomainId('resource', 'membership-resource')
    const disposeAvailability = vi.fn()
    let applyAvailability: ((value: boolean) => void) | undefined
    let applyResource: ((value: ReturnType<typeof snapshot>) => void) | undefined
    const runtime = createLiveResourceIndexRuntime(scope, {
      watchAvailability: (_args, apply) => {
        applyAvailability = apply
        apply(true)
        return disposeAvailability
      },
      watchResource: (_args, apply) => {
        applyResource = apply
        apply(snapshot([resource(resourceId)]))
        return vi.fn()
      },
      watchCollection: vi.fn(),
    })

    runtime.start()
    await runtime.loader.ensureResource(resourceId)
    expect(runtime.index.getSnapshot().lookup(resourceId).state).toBe('known')

    applyAvailability?.(false)
    expect(runtime.index.getSnapshot().lookup(resourceId).state).toBe('unknown')

    applyAvailability?.(true)
    expect(runtime.index.getSnapshot().lookup(resourceId).state).toBe('unknown')

    applyResource?.(snapshot([resource(resourceId)]))
    expect(runtime.index.getSnapshot().lookup(resourceId).state).toBe('known')

    runtime.dispose()
    expect(disposeAvailability).toHaveBeenCalledOnce()
  })

  it('retracts later collection pages when an earlier reactive cursor changes', async () => {
    const firstId = testDomainId('resource', 'reactive-page-one')
    const secondId = testDomainId('resource', 'reactive-page-two')
    const query = { parentId: null, lifecycle: 'active' as const }
    const updates: Array<
      (value: { snapshot: ReturnType<typeof snapshot>; cursor: string | null }) => void
    > = []
    const disposes = [vi.fn(), vi.fn(), vi.fn()]
    const watchCollection = vi.fn((_args, apply) => {
      const page = updates.length
      updates.push(apply)
      apply(
        page === 0
          ? {
              snapshot: snapshot([resource(firstId)], {
                collections: [{ query, resourceIds: [firstId], complete: false }],
              }),
              cursor: 'cursor-1',
            }
          : {
              snapshot: snapshot([resource(secondId)], {
                collections: [{ query, resourceIds: [secondId], complete: true }],
              }),
              cursor: null,
            },
      )
      return disposes[page]!
    })
    const runtime = createLiveResourceIndexRuntime(scope, {
      watchAvailability: vi.fn(),
      watchResource: vi.fn(),
      watchCollection,
    })

    await runtime.loader.ensureCollection(query)
    await runtime.loader.ensureCollection(query)
    expect(runtime.index.getSnapshot().lookup(secondId).state).toBe('known')

    updates[0]?.({
      snapshot: snapshot([resource(firstId)], {
        collections: [{ query, resourceIds: [firstId], complete: false }],
      }),
      cursor: 'cursor-2',
    })

    expect(disposes[1]).toHaveBeenCalledOnce()
    expect(runtime.index.getSnapshot().lookup(secondId).state).not.toBe('known')
    expect(runtime.index.getSnapshot().list(query)).toMatchObject({
      state: 'known',
      complete: false,
      items: [expect.objectContaining({ id: firstId })],
    })

    await runtime.loader.ensureCollection(query)
    expect(watchCollection).toHaveBeenLastCalledWith(
      {
        campaignId: scope.campaignId,
        query,
        cursor: 'cursor-2',
      },
      expect.any(Function),
    )
  })

  it('rejects a provider response from another projection without publishing it', async () => {
    const resourceId = testDomainId('resource', 'foreign')
    const runtime = createLiveResourceIndexRuntime(
      scope,
      subscribedQueries(
        vi.fn(() =>
          Promise.resolve(
            snapshot([resource(resourceId)], { scopeOverride: { projection: 'player' } }),
          ),
        ),
        vi.fn(),
      ),
    )

    await expect(runtime.loader.ensureResource(resourceId)).resolves.toEqual({
      status: 'failed',
      retryable: false,
      reason: 'invalid_response',
    })
    expect(runtime.index.getSnapshot().lookup(resourceId)).toEqual({ state: 'unknown' })
  })

  it('normalizes provider failures as retryable load failures', async () => {
    const resourceId = testDomainId('resource', 'offline')
    const runtime = createLiveResourceIndexRuntime(scope, {
      watchAvailability: vi.fn(),
      watchResource: () => {
        throw new Error('offline')
      },
      watchCollection: vi.fn(),
    })

    await expect(runtime.loader.ensureResource(resourceId)).resolves.toEqual({
      status: 'failed',
      retryable: true,
      reason: 'provider_failure',
    })
  })
})
