import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { createSidebarItem } from './test-sidebar-item'
import { planCopyTransfer, planMoveTransfer } from './transfer-planning-test-helpers'

describe('copy transfer planning', () => {
  it('returns no operations for empty inputs', () => {
    expect(planCopyTransfer({ items: [], targetParentId: null, targetItems: [] })).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [],
    })
  })

  it('preserves duplicate sibling titles exactly', () => {
    const result = planCopyTransfer({
      items: [createSidebarItem('note-1', 'Scene')],
      targetParentId: null,
      targetItems: [createSidebarItem('note-2', 'Scene')],
    })

    expect(result).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        { action: 'place', sourceItemId: 'note-1', targetParentId: null, name: 'Scene' },
      ],
    })
  })

  it('ignores descendants when an ancestor folder is selected', () => {
    const folder = createSidebarItem('folder-1', 'Scenes', RESOURCE_TYPES.folders)
    const child = createSidebarItem('note-1', 'Scene', RESOURCE_TYPES.notes, {
      parentId: folder.id,
    })

    expect(
      planCopyTransfer({
        items: [folder, child],
        targetParentId: null,
        targetItems: [],
        getChildren: (parentId) => (parentId === folder.id ? [child] : []),
      }),
    ).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        { action: 'place', sourceItemId: 'folder-1', targetParentId: null, name: 'Scenes' },
      ],
    })
  })
})

describe('move transfer planning', () => {
  it('moves into a duplicate sibling title without changing metadata', () => {
    const source = createSidebarItem('note-1', 'Scene', RESOURCE_TYPES.notes, {
      parentId: 'source-folder' as SidebarItemId,
    })

    expect(
      planMoveTransfer({
        items: [source],
        targetParentId: null,
        targetItems: [createSidebarItem('note-2', 'Scene')],
        graphItems: [createSidebarItem('source-folder', 'Source', RESOURCE_TYPES.folders)],
      }),
    ).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [{ action: 'place', sourceItemId: 'note-1', targetParentId: null }],
    })
  })

  it('returns no operation for an active same-parent move', () => {
    const source = createSidebarItem('note-1', 'Scene')

    expect(
      planMoveTransfer({ items: [source], targetParentId: null, targetItems: [source] }),
    ).toEqual({ status: 'ready', conflicts: [], operations: [] })
  })
})
