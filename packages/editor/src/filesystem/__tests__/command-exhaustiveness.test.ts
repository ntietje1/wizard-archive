import { describe, expect, it } from 'vite-plus/test'

import { createFolder, createNote } from '../../test/sidebar-item-factory'
import type { SidebarCacheSnapshot } from '../cache-patches'
import { createReadWriteTestCache } from './cache-test-utils'
import { commandFixtureItemIds, fileSystemCommandFixtures } from './command-fixtures'
import { RESOURCE_COMMAND_TYPE } from '../transaction-contract'
import { planFileSystemOptimisticCommand } from '../optimistic-planner'
import type { CampaignId } from '../../../../../shared/common/ids'

const campaignId = 'campaign_1' as CampaignId

describe('filesystem command exhaustiveness', () => {
  it('keeps optimistic planning covered for every command type', () => {
    const fixtureItem = createNote({
      id: commandFixtureItemIds.source,
      name: 'Fixture',
    })
    const fixtureFolder = createFolder({
      id: commandFixtureItemIds.folder,
      name: 'Folder',
    })
    const snapshot: SidebarCacheSnapshot = { sidebar: [fixtureItem, fixtureFolder], trash: [] }
    const cacheAdapter = createReadWriteTestCache(snapshot)

    for (const commandType of Object.values(RESOURCE_COMMAND_TYPE)) {
      expect(() =>
        planFileSystemOptimisticCommand({
          command: fileSystemCommandFixtures[commandType],
          snapshot,
          readModel: cacheAdapter.getReadModel(),
          activeItemSurface: { parentId: null },
          currentUserId: null,
          workspaceId: campaignId,
        }),
      ).not.toThrow()
    }
  })
})
