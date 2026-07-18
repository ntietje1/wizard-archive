import { describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import type { ResourceLoadResult } from '@wizard-archive/editor/resources/index-contract'
import { createLiveResourceBookmarks, createLiveWorkspaceSearch } from '../live-workspace-discovery'

const campaignId = testDomainId('campaign', 'discovery')
const actorId = testDomainId('campaignMember', 'discovery')
const resourceId = testDomainId('resource', 'discovery')
const unrelatedResourceId = testDomainId('resource', 'unrelated')
type ApplyProjection = Parameters<typeof createLiveResourceBookmarks>[1]
type StoredProjection = Parameters<ApplyProjection>[0]
type BookmarkBackend = Parameters<typeof createLiveResourceBookmarks>[2]
type BookmarkProjection = Parameters<Parameters<BookmarkBackend['watch']>[0]>[0]

const snapshot: StoredProjection = {
  scope: {
    campaignId,
    actorId,
    projection: 'dm' as const,
    schema: RESOURCE_INDEX_SCHEMA,
  },
  revision: 'projection',
  resources: [
    {
      id: resourceId,
      campaignId,
      displayParentId: null,
      kind: 'note' as const,
      title: 'Discovery',
      icon: null,
      color: null,
      lifecycle: 'active' as const,
      permission: 'edit' as const,
      metadataVersion: {
        scheme: 'authoritative-revision-v1' as const,
        revision: 1,
        digest: 'a'.repeat(64),
      },
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  missingResourceIds: [],
  collections: [],
}

describe('live workspace discovery', () => {
  it('hydrates bookmark resource knowledge before publishing bookmark ids', () => {
    let publish: ((value: BookmarkProjection) => void) | undefined
    const applyProjection = vi.fn((): ResourceLoadResult => ({ status: 'completed' }))
    const bookmarks = createLiveResourceBookmarks(campaignId, applyProjection, {
      execute: vi.fn(),
      watch: (apply) => {
        publish = apply
        return () => {}
      },
    })
    bookmarks.start()

    expect(bookmarks.gateway.get()).toEqual({ state: 'unknown' })
    expect(publish).toBeDefined()
    publish!({ resourceIds: [resourceId], snapshot })

    expect(applyProjection).toHaveBeenCalledWith(snapshot)
    expect(bookmarks.gateway.get()).toEqual({ state: 'known', value: new Set([resourceId]) })
    bookmarks.dispose()
  })

  it('rejects an incomplete bookmark envelope before applying or publishing it', () => {
    let publish: ((value: BookmarkProjection) => void) | undefined
    const applyProjection = vi.fn((): ResourceLoadResult => ({ status: 'completed' }))
    const listener = vi.fn()
    const bookmarks = createLiveResourceBookmarks(campaignId, applyProjection, {
      execute: vi.fn(),
      watch: (apply) => {
        publish = apply
        return () => {}
      },
    })
    bookmarks.gateway.subscribe(listener)
    bookmarks.start()

    publish!({
      resourceIds: [resourceId],
      snapshot: { ...snapshot, resources: [] },
    })

    expect(applyProjection).not.toHaveBeenCalled()
    expect(bookmarks.gateway.get()).toEqual({ state: 'unknown' })
    expect(listener).not.toHaveBeenCalled()
    bookmarks.dispose()
  })

  it('withdraws stale bookmark knowledge after an invalid update and recovers later', () => {
    let publish: ((value: BookmarkProjection) => void) | undefined
    const applyProjection = vi.fn((): ResourceLoadResult => ({ status: 'completed' }))
    const listener = vi.fn()
    const bookmarks = createLiveResourceBookmarks(campaignId, applyProjection, {
      execute: vi.fn(),
      watch: (apply) => {
        publish = apply
        return () => {}
      },
    })
    bookmarks.gateway.subscribe(listener)
    bookmarks.start()

    publish!({ resourceIds: [resourceId], snapshot })
    expect(bookmarks.gateway.get()).toEqual({ state: 'known', value: new Set([resourceId]) })

    publish!({
      resourceIds: [resourceId],
      snapshot: { ...snapshot, resources: [], missingResourceIds: [] },
    })
    expect(bookmarks.gateway.get()).toEqual({ state: 'unknown' })
    expect(applyProjection).toHaveBeenCalledTimes(1)

    publish!({ resourceIds: [resourceId], snapshot })
    expect(bookmarks.gateway.get()).toEqual({ state: 'known', value: new Set([resourceId]) })
    expect(listener).toHaveBeenCalledTimes(3)
    bookmarks.dispose()
  })

  it('publishes bookmarks whose targets are explicitly missing', () => {
    let publish: ((value: BookmarkProjection) => void) | undefined
    const applyProjection = vi.fn((): ResourceLoadResult => ({ status: 'completed' }))
    const bookmarks = createLiveResourceBookmarks(campaignId, applyProjection, {
      execute: vi.fn(),
      watch: (apply) => {
        publish = apply
        return () => {}
      },
    })
    bookmarks.start()

    publish!({
      resourceIds: [resourceId],
      snapshot: { ...snapshot, resources: [], missingResourceIds: [resourceId] },
    })

    expect(applyProjection).toHaveBeenCalledOnce()
    expect(bookmarks.gateway.get()).toEqual({ state: 'known', value: new Set([resourceId]) })
    bookmarks.dispose()
  })

  it('hydrates search resource knowledge before returning results', async () => {
    const applyProjection = vi.fn((): ResourceLoadResult => ({ status: 'completed' }))
    const search = createLiveWorkspaceSearch(
      campaignId,
      actorId,
      applyProjection,
      vi.fn(() =>
        Promise.resolve({
          status: 'complete' as const,
          results: [{ resourceId, match: { type: 'title' as const } }],
          snapshot,
        }),
      ),
    )

    await expect(search.search('discovery')).resolves.toEqual({
      status: 'complete',
      results: [{ resourceId, match: { type: 'title' } }],
    })
    expect(applyProjection).toHaveBeenCalledWith(snapshot)
  })

  it('preserves a truthful incomplete search outcome', async () => {
    const applyProjection = vi.fn((): ResourceLoadResult => ({ status: 'completed' }))
    const search = createLiveWorkspaceSearch(
      campaignId,
      actorId,
      applyProjection,
      vi.fn(() =>
        Promise.resolve({
          status: 'incomplete' as const,
          results: [{ resourceId, match: { type: 'title' as const } }],
          snapshot,
        }),
      ),
    )

    await expect(search.search('common')).resolves.toEqual({
      status: 'incomplete',
      results: [{ resourceId, match: { type: 'title' } }],
    })
  })

  it('rejects an incomplete search envelope before applying it', async () => {
    const applyProjection = vi.fn((): ResourceLoadResult => ({ status: 'completed' }))
    const search = createLiveWorkspaceSearch(
      campaignId,
      actorId,
      applyProjection,
      vi.fn(() =>
        Promise.resolve({
          status: 'complete' as const,
          results: [{ resourceId, match: { type: 'title' as const } }],
          snapshot: { ...snapshot, resources: [] },
        }),
      ),
    )

    await expect(search.search('discovery')).rejects.toThrow(
      'Search result is not projected as known',
    )
    expect(applyProjection).not.toHaveBeenCalled()
  })

  it('rejects a search result projected as missing', async () => {
    const applyProjection = vi.fn((): ResourceLoadResult => ({ status: 'completed' }))
    const search = createLiveWorkspaceSearch(
      campaignId,
      actorId,
      applyProjection,
      vi.fn(() =>
        Promise.resolve({
          status: 'complete' as const,
          results: [{ resourceId, match: { type: 'title' as const } }],
          snapshot: { ...snapshot, resources: [], missingResourceIds: [resourceId] },
        }),
      ),
    )

    await expect(search.search('discovery')).rejects.toThrow(
      'Search result is not projected as known',
    )
    expect(applyProjection).not.toHaveBeenCalled()
  })

  it('accepts valid projection knowledge unrelated to the search result', async () => {
    const applyProjection = vi.fn((): ResourceLoadResult => ({ status: 'completed' }))
    const search = createLiveWorkspaceSearch(
      campaignId,
      actorId,
      applyProjection,
      vi.fn(() =>
        Promise.resolve({
          status: 'complete' as const,
          results: [{ resourceId, match: { type: 'title' as const } }],
          snapshot: {
            ...snapshot,
            resources: [
              ...snapshot.resources,
              {
                ...snapshot.resources[0]!,
                id: unrelatedResourceId,
                title: 'Unrelated',
              },
            ],
          },
        }),
      ),
    )

    await expect(search.search('discovery')).resolves.toEqual({
      status: 'complete',
      results: [{ resourceId, match: { type: 'title' } }],
    })
    expect(applyProjection).toHaveBeenCalledOnce()
  })
})
