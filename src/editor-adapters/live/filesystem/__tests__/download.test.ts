import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { describe, expect, it, vi } from 'vite-plus/test'
import { testCampaignId } from '../../../../../shared/test/campaign-id'
import { api } from 'convex/_generated/api'
import { createLiveWorkspaceDownloadSource } from '../download'

const CAMPAIGN_ID = testCampaignId('campaign_1')

describe('createLiveWorkspaceDownloadSource', () => {
  it('maps source-neutral download loader calls to live folder queries', async () => {
    const query = vi.fn().mockResolvedValue({ items: [] })
    const dataSource = createLiveWorkspaceDownloadSource({ query }, CAMPAIGN_ID, {
      canDownloadRoot: true,
    })

    expect(dataSource.kind).toBe('remoteItems')
    if (dataSource.kind !== 'remoteItems') throw new Error('Expected remote item data source')
    await dataSource.loadItemsForDownload({
      itemIds: ['note_1' as ResourceId],
    })
    await dataSource.loadRootItemsForDownload()

    expect(query).toHaveBeenNthCalledWith(1, api.folders.queries.getSidebarItemsForDownload, {
      campaignId: CAMPAIGN_ID,
      sourceItemIds: ['note_1'],
    })
    expect(query).toHaveBeenNthCalledWith(2, api.folders.queries.getRootContentsForDownload, {
      campaignId: CAMPAIGN_ID,
    })
  })

  it('keeps selected-item downloads available while disabling root downloads for players', async () => {
    const query = vi.fn().mockResolvedValue({ items: [] })
    const dataSource = createLiveWorkspaceDownloadSource({ query }, CAMPAIGN_ID, {
      canDownloadRoot: false,
    })

    await dataSource.loadItemsForDownload({
      itemIds: ['note_1' as ResourceId],
    })
    await expect(dataSource.loadRootItemsForDownload()).resolves.toEqual({
      status: 'unsupported',
      reason: 'not_dm',
      items: [],
    })

    expect(query).toHaveBeenCalledExactlyOnceWith(api.folders.queries.getSidebarItemsForDownload, {
      campaignId: CAMPAIGN_ID,
      sourceItemIds: ['note_1'],
    })
  })
})
