import { describe, expect, it } from 'vite-plus/test'

import { projectLiveSidebarItem } from '../project-live-sidebar-item'
import type { WizardEditorItem } from '@wizard-archive/editor/adapter'

describe('projectLiveSidebarItem', () => {
  it('preserves canonical asset identities from the live query', () => {
    const previewAssetId = '019817c2-7df0-7000-8000-000000000001'
    const item = projectLiveSidebarItem<WizardEditorItem>({
      id: 'item',
      createdAt: 1,
      name: 'Item',
      slug: 'item',
      campaignId: 'campaign',
      parentId: null,
      type: 'note',
      allPermissionLevel: null,
      location: 'sidebar',
      status: 'active',
      previewAssetId,
      updatedTime: null,
      updatedBy: null,
      createdBy: 'user',
      deletionTime: null,
      deletedBy: null,
      isActive: true,
      isTrashed: false,
      iconName: null,
      color: null,
      shares: [],
      isBookmarked: false,
      myPermissionLevel: 'full_access',
      previewUrl: null,
    })

    expect(item.previewAssetId).toBe(previewAssetId)
    expect(item).not.toHaveProperty('previewStorageId')
  })
})
