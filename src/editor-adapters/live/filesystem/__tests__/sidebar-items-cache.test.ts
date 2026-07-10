import { describe, expect, it } from 'vite-plus/test'
import type { WizardEditorItem } from '@wizard-archive/editor/adapter'
import {
  mergeProjectedItemsIntoLiveRows,
  projectLiveSidebarItems,
} from '../../sidebar/project-live-sidebar-item'

describe('mergeProjectedItemsIntoLiveRows', () => {
  it('keeps raw asset storage fields authoritative across optimistic cache updates', () => {
    const rows = [
      {
        id: 'file-1',
        type: 'file',
        previewStorageId: 'preview-asset',
        storageId: 'file-asset',
      },
      {
        id: 'map-1',
        type: 'gameMap',
        imageStorageId: 'map-asset',
        layers: [{ id: 'layer-1', imageStorageId: 'layer-asset' }],
      },
    ]
    const projected = projectLiveSidebarItems<WizardEditorItem>(rows)

    const merged = mergeProjectedItemsIntoLiveRows(rows, projected)

    expect(merged).toEqual([
      expect.objectContaining({
        id: 'file-1',
        previewStorageId: 'preview-asset',
        storageId: 'file-asset',
      }),
      expect.objectContaining({
        id: 'map-1',
        imageStorageId: 'map-asset',
        layers: [{ id: 'layer-1', imageStorageId: 'layer-asset' }],
      }),
    ])
    expect(merged[0]).not.toHaveProperty('assetId')
    expect(merged[0]).not.toHaveProperty('previewAssetId')
    expect(merged[1]).not.toHaveProperty('imageAssetId')
    expect(projectLiveSidebarItems<WizardEditorItem>(merged)).toEqual(projected)
  })
})
