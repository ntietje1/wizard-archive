import { describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import type { ResourceLoadResult } from '@wizard-archive/editor/resources/index-contract'
import { createLiveResourceBookmarks, createLiveWorkspaceSearch } from '../live-workspace-discovery'

const campaignId = testDomainId('campaign', 'discovery')
const actorId = testDomainId('campaignMember', 'discovery')
const resourceId = testDomainId('resource', 'discovery')
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

    expect(bookmarks.gateway.get()).toEqual({ state: 'unknown' })
    expect(publish).toBeDefined()
    publish!({ resourceIds: [resourceId], snapshot })

    expect(applyProjection).toHaveBeenCalledWith(snapshot)
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
          results: [{ resourceId, match: { type: 'title' as const } }],
          snapshot,
        }),
      ),
    )

    await expect(search.search('discovery')).resolves.toEqual([
      { resourceId, match: { type: 'title' } },
    ])
    expect(applyProjection).toHaveBeenCalledWith(snapshot)
  })
})
