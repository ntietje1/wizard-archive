import { describe, expect, it } from 'vite-plus/test'

import { projectLiveSidebarItem } from '../project-live-sidebar-item'
import type { WizardEditorItem } from '@wizard-archive/editor/adapter'

describe('projectLiveSidebarItem', () => {
  it('projects preview storage into the editor resource contract', () => {
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
      previewStorageId: 'preview-storage',
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

    expect(item.previewAssetId).toBe('preview-storage')
    expect(item).not.toHaveProperty('previewStorageId')
  })
})
