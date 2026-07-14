import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { RESOURCE_STATUS } from '../../workspace/items-persistence-contract'
import { testCampaignId } from '../../../../../shared/test/campaign-id'
import {
  createFile,
  createFolder,
  createNote,
  resetSidebarItemFactoryCounter,
} from '../sidebar-item-factory'

describe('sidebar item factory', () => {
  it('resets generated ids and base fields', () => {
    resetSidebarItemFactoryCounter()
    createNote()
    createFolder()

    resetSidebarItemFactoryCounter()
    const note = createNote()

    expect(note).toMatchObject({
      id: 'note_1',
      createdAt: 1,
      name: 'Test Item 1',
      slug: 'test-item-1',
      campaignId: testCampaignId('campaign_1'),
      createdBy: 'user_1',
    })
  })

  it('preserves override precedence and lifecycle facts through the shared builder', () => {
    resetSidebarItemFactoryCounter()

    const folder = createFolder({
      id: 'folder_override' as SidebarItemId,
      inheritShares: false,
      name: 'Scenes',
      slug: 'scene-folder',
      status: RESOURCE_STATUS.trashed,
    })
    const file = createFile({
      contentType: 'application/pdf',
      name: 'Handout',
    })

    expect(folder).toMatchObject({
      id: 'folder_override',
      inheritShares: false,
      isActive: false,
      isTrashed: true,
      name: 'Scenes',
      slug: 'scene-folder',
    })
    expect(file).toMatchObject({
      contentType: 'application/pdf',
      name: 'Handout',
    })
  })
})
