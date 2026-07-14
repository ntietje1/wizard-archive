import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { GameMapSnapshotData } from '../document-contract'
import { readGameMapSnapshot } from '../document-contract'
import { testMapPinId } from '../../test/map-pin-id'
import { testAssetId } from '../../../../../shared/test/asset-id'

describe('readGameMapSnapshot', () => {
  it('parses a stored game map snapshot with its image and pins', () => {
    const snapshot: GameMapSnapshotData = {
      imageAssetId: testAssetId('asset-1'),
      pins: [
        {
          id: testMapPinId('snapshot-pin'),
          itemId: 'note-1' as SidebarItemId,
          x: 12,
          y: 34,
          visible: true,
          name: 'Hidden Shrine',
          color: '#cc8844',
          iconName: 'MapPin',
          itemType: RESOURCE_TYPES.notes,
        },
      ],
    }

    const data = new TextEncoder().encode(JSON.stringify(snapshot)).buffer

    expect(readGameMapSnapshot(data)).toEqual(snapshot)
  })
})
