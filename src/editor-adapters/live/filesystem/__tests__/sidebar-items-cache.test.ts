import { describe, expect, it } from 'vite-plus/test'
import type { WizardEditorItem } from '@wizard-archive/editor/adapter'
import {
  mergeProjectedItemsIntoLiveRows,
  projectLiveSidebarItems,
} from '../../sidebar/project-live-sidebar-item'

describe('mergeProjectedItemsIntoLiveRows', () => {
  it('keeps canonical asset fields authoritative across optimistic cache updates', () => {
    const rows = [
      {
        id: 'file-1',
        type: 'file',
        previewAssetId: '019817c2-7df0-7000-8000-000000000001',
        assetId: '019817c2-7df0-7000-8000-000000000002',
      },
      {
        id: 'map-1',
        type: 'gameMap',
        imageAssetId: '019817c2-7df0-7000-8000-000000000003',
        layers: [{ id: 'layer-1', imageAssetId: '019817c2-7df0-7000-8000-000000000004' }],
      },
    ]
    const projected = projectLiveSidebarItems<WizardEditorItem>(rows)

    const merged = mergeProjectedItemsIntoLiveRows(rows, projected)

    expect(merged).toEqual([
      expect.objectContaining({
        id: 'file-1',
        previewAssetId: '019817c2-7df0-7000-8000-000000000001',
        assetId: '019817c2-7df0-7000-8000-000000000002',
      }),
      expect.objectContaining({
        id: 'map-1',
        imageAssetId: '019817c2-7df0-7000-8000-000000000003',
        layers: [{ id: 'layer-1', imageAssetId: '019817c2-7df0-7000-8000-000000000004' }],
      }),
    ])
    expect(projectLiveSidebarItems<WizardEditorItem>(merged)).toEqual(projected)
  })
})
