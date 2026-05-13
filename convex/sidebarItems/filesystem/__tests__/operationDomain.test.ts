import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from '../../types/baseTypes'
import { createSidebarItem } from './testSidebarItem'
import { planMoveOperations } from '../movePlanner'
import { normalizeTopLevelSelectedItemsBestEffort } from '../selection'
import type { Id } from '../../../_generated/dataModel'
import type { AnySidebarItem } from '../../types/types'

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

    const selectedRoots = normalizeTopLevelSelectedItemsBestEffort([folder, child], itemsMap)
    const plan = planMoveOperations({
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

    const selectedRoots = normalizeTopLevelSelectedItemsBestEffort([noteA, noteB], itemsMap)
    const plan = planMoveOperations({
      items: selectedRoots,
      targetParentId: targetFolder._id,
      targetItems: [],
    })

    expect(selectedRoots.map((selected) => selected._id)).toEqual([noteA._id, noteB._id])
    expect(plan).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [
        { sourceItemId: noteA._id, action: 'move', targetParentId: targetFolder._id },
        { sourceItemId: noteB._id, action: 'move', targetParentId: targetFolder._id },
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

    expect(
      normalizeTopLevelSelectedItemsBestEffort([grandparent, parent, child], itemsMap),
    ).toEqual([grandparent])
  })

  it('detects circular parent references during selection normalization without throwing', () => {
    const folderA = createSidebarItem('folder-1', 'A', SIDEBAR_ITEM_TYPES.folders, {
      parentId: 'folder-2' as Id<'sidebarItems'>,
    })
    const folderB = createSidebarItem('folder-2', 'B', SIDEBAR_ITEM_TYPES.folders, {
      parentId: folderA._id,
    })

    expect(
      normalizeTopLevelSelectedItemsBestEffort(
        [folderA],
        new Map<Id<'sidebarItems'>, AnySidebarItem>([
          [folderA._id, folderA],
          [folderB._id, folderB],
        ]),
      ),
    ).toEqual([folderA])
  })

  it('handles empty selection and plans no operations', () => {
    expect(normalizeTopLevelSelectedItemsBestEffort([], new Map())).toEqual([])
    expect(
      planMoveOperations({
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
      planMoveOperations({
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
      planMoveOperations({
        items: [child],
        targetParentId: parent._id,
        targetItems: [],
      }),
    ).toEqual({
      status: 'ready',
      conflicts: [],
      operations: [],
    })
  })
})
