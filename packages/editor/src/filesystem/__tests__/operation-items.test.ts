import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_STATUS } from '../../workspace/items-persistence-contract'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { createResourceCatalogModel } from '../catalog'

describe('ResourceOperationItems', () => {
  it('resolves selected operation ids as normalized roots from active and trashed items', () => {
    const folder = createFolder({ name: 'Folder' })
    const child = createNote({ name: 'Child', parentId: folder.id })
    const sibling = createNote({ name: 'Sibling' })
    const trashed = createNote({
      name: 'Trash',
      status: RESOURCE_STATUS.trashed,
    })
    const { operationItems } = createResourceCatalogModel({
      activeItems: [folder, child, sibling],
      trashItems: [trashed],
    })

    expect(
      operationItems.resolveItems({
        itemIds: [child.id, folder.id, sibling.id, trashed.id],
      }),
    ).toEqual([folder, sibling, trashed])
  })

  it('supports exclusions and active-only operation item resolution', () => {
    const active = createNote({ name: 'Active' })
    const excluded = createNote({ name: 'Excluded' })
    const trashed = createNote({
      name: 'Trash',
      status: RESOURCE_STATUS.trashed,
    })
    const { operationItems } = createResourceCatalogModel({
      activeItems: [active, excluded],
      trashItems: [trashed],
    })

    expect(
      operationItems.resolveItems({
        itemIds: [active.id, excluded.id, trashed.id],
        excludeItemIds: [excluded.id],
        includeTrashed: false,
      }),
    ).toEqual([active])
  })
})
