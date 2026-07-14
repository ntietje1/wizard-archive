import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { Id } from 'convex/_generated/dataModel'
import { api } from 'convex/_generated/api'
import { createLiveWorkspaceDownloadSource } from '../download'

describe('createLiveWorkspaceDownloadSource', () => {
  it('maps source-neutral download loader calls to live folder queries', async () => {
    const query = vi.fn().mockResolvedValue({ items: [] })
    const dataSource = createLiveWorkspaceDownloadSource(
      { query },
      'campaign_1' as Id<'campaigns'>,
      { canDownloadRoot: true },
    )

    expect(dataSource.kind).toBe('remoteItems')
    if (dataSource.kind !== 'remoteItems') throw new Error('Expected remote item data source')
    await dataSource.loadItemsForDownload({
      itemIds: ['note_1' as ResourceId],
    })
    await dataSource.loadRootItemsForDownload()

    expect(query).toHaveBeenNthCalledWith(1, api.folders.queries.getSidebarItemsForDownload, {
      campaignId: 'campaign_1',
      sourceItemIds: ['note_1'],
    })
    expect(query).toHaveBeenNthCalledWith(2, api.folders.queries.getRootContentsForDownload, {
      campaignId: 'campaign_1',
    })
  })

  it('keeps selected-item downloads available while disabling root downloads for players', async () => {
    const query = vi.fn().mockResolvedValue({ items: [] })
    const dataSource = createLiveWorkspaceDownloadSource(
      { query },
      'campaign_1' as Id<'campaigns'>,
      { canDownloadRoot: false },
    )

    await dataSource.loadItemsForDownload({
      itemIds: ['note_1' as ResourceId],
    })
    await expect(dataSource.loadRootItemsForDownload()).resolves.toEqual({
      status: 'unsupported',
      reason: 'not_dm',
      items: [],
    })

    expect(query).toHaveBeenCalledExactlyOnceWith(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: 'campaign_1',
      sourceItemIds: ['note_1'],
    })
  })
})
