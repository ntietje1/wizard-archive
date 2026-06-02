import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from '../../../../shared/sidebar-items/types'
import { createSidebarItem } from './testSidebarItem'
import { planTransferOperations } from '../../../../shared/sidebar-items/filesystem/transfer-planner'
import { normalizeSelectedRoots } from '../../../../shared/sidebar-items/filesystem/selection'
import type { OperationPlannerItem } from '../../../../shared/sidebar-items/filesystem/selection'
import type { Id } from '../../../_generated/dataModel'
import type { AnySidebarItem } from '../../../../shared/sidebar-items/model-types'

function planMoveTransfer(
  args: Omit<Parameters<typeof planTransferOperations>[0], 'itemsById' | 'mode'> & {
    graphItems?: Array<OperationPlannerItem>
  },
) {
  const itemsById = new Map<Id<'sidebarItems'>, OperationPlannerItem>()
  // Later sources intentionally win: graphItems > targetItems > items, and getChildren entries
  // are merged after their parent so test fixtures can override duplicate rows explicitly.
  for (const item of [...args.items, ...args.targetItems, ...(args.graphItems ?? [])]) {
    itemsById.set(item._id, item)
    for (const child of args.getChildren?.(item._id) ?? []) {
      itemsById.set(child._id, child)
    }
  }
  return planTransferOperations({ ...args, mode: 'move', itemsById })
}

describe('filesystem operation domain', () => {
  it('normalizes parent and child selection to parent only and plans no-op move', () => {
    const folder = createSidebarItem('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders)
    const child = createSidebarItem('note-1', 'Child', SIDEBAR_ITEM_TYPES.notes, {
      parentId: folder._id,
    })
    const itemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([
      [folder._id, folder],
      [child._id, child],
    ])

    const selectedRoots = normalizeSelectedRoots([folder, child], itemsMap)
    const plan = planMoveTransfer({
      items: selectedRoots,
      targetParentId: null,
      targetItems: [],
      getChildren: (parentId) => (parentId === folder._id ? [child] : []),
    })

    expect(selectedRoots.map((selected) => selected._id)).toEqual([folder._id])
    expect(plan).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [],
    })
  })

  it('keeps unrelated selected roots and plans a real move', () => {
    const noteA = createSidebarItem('note-1', 'A')
    const noteB = createSidebarItem('note-2', 'B')
    const targetFolder = createSidebarItem('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders)
    const itemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([
      [noteA._id, noteA],
      [noteB._id, noteB],
      [targetFolder._id, targetFolder],
    ])

    const selectedRoots = normalizeSelectedRoots([noteA, noteB], itemsMap)
    const plan = planMoveTransfer({
      items: selectedRoots,
      targetParentId: targetFolder._id,
      targetItems: [],
    })

    expect(selectedRoots.map((selected) => selected._id)).toEqual([noteA._id, noteB._id])
    expect(plan).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        { sourceItemId: noteA._id, action: 'place', targetParentId: targetFolder._id },
        { sourceItemId: noteB._id, action: 'place', targetParentId: targetFolder._id },
      ],
    })
  })

  it('normalizes multi-level selected descendants to the highest selected ancestor', () => {
    const grandparent = createSidebarItem('folder-1', 'Grandparent', SIDEBAR_ITEM_TYPES.folders)
    const parent = createSidebarItem('folder-2', 'Parent', SIDEBAR_ITEM_TYPES.folders, {
      parentId: grandparent._id,
    })
    const child = createSidebarItem('note-1', 'Child', SIDEBAR_ITEM_TYPES.notes, {
      parentId: parent._id,
    })
    const itemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([
      [grandparent._id, grandparent],
      [parent._id, parent],
      [child._id, child],
    ])

    expect(normalizeSelectedRoots([grandparent, parent, child], itemsMap)).toEqual([grandparent])
  })

  it('throws on circular parent references during selection normalization', () => {
    const folderA = createSidebarItem('folder-1', 'A', SIDEBAR_ITEM_TYPES.folders, {
      parentId: 'folder-2' as Id<'sidebarItems'>,
    })
    const folderB = createSidebarItem('folder-2', 'B', SIDEBAR_ITEM_TYPES.folders, {
      parentId: folderA._id,
    })

    expect(() =>
      normalizeSelectedRoots(
        [folderA],
        new Map<Id<'sidebarItems'>, AnySidebarItem>([
          [folderA._id, folderA],
          [folderB._id, folderB],
        ]),
      ),
    ).toThrow(/Cycle detected/)
  })

  it('handles empty selection and plans no operations', () => {
    expect(normalizeSelectedRoots([], new Map())).toEqual([])
    expect(
      planMoveTransfer({
        items: [],
        targetParentId: null,
        targetItems: [],
      }),
    ).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [],
    })
  })

  it('uses target items to surface name conflicts', () => {
    const source = createSidebarItem('note-1', 'Conflict')
    const target = createSidebarItem('note-2', 'Conflict')

    expect(
      planMoveTransfer({
        items: [source],
        targetParentId: null,
        targetItems: [target],
      }),
    ).toEqual({
      status: 'needs-decision',
      conflicts: [
        {
          kind: 'name-conflict',
          sourceItemId: source._id,
          destinationItemId: target._id,
          sourceName: source.name,
          destinationName: target.name,
          sourceType: source.type,
          destinationType: target.type,
        },
      ],
      operations: [],
    })
  })

  it('plans moving an item to its current parent as a no-op', () => {
    const parent = createSidebarItem('folder-1', 'Parent', SIDEBAR_ITEM_TYPES.folders)
    const child = createSidebarItem('note-1', 'Child', SIDEBAR_ITEM_TYPES.notes, {
      parentId: parent._id,
    })

    expect(
      planMoveTransfer({
        items: [child],
        targetParentId: parent._id,
        targetItems: [],
        graphItems: [parent],
      }),
    ).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [],
    })
  })
})
