import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { createFolder } from '../../test/sidebar-item-factory'
import { planTransferOperations } from '../operation-contract'

describe('planTransferOperations', () => {
  it('copies a duplicate folder as an independent resource with the same title', () => {
    const source = createFolder({ id: 'source' as SidebarItemId, name: 'Scenes' })
    const target = createFolder({ id: 'target' as SidebarItemId, name: 'Scenes' })

    expect(
      planTransferOperations({
        mode: 'copy',
        items: [source],
        itemsById: new Map([
          [source.id, source],
          [target.id, target],
        ]),
        targetParentId: null,
        targetItems: [target],
      }),
    ).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        { action: 'place', sourceItemId: source.id, targetParentId: null, name: 'Scenes' },
      ],
    })
  })
})
