import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import type { AnyItem } from '../../../workspace/items'
import { createSidebarItem } from './test-sidebar-item'
import { normalizeSelectedRoots } from '../selection-roots'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { planMoveTransfer } from './transfer-planning-test-helpers'

describe('filesystem operation domain', () => {
  it('normalizes parent and child selection to parent only and plans no-op move', () => {
    const folder = createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders)
    const child = createSidebarItem('note-1', 'Child', RESOURCE_TYPES.notes, {
      parentId: folder.id,
    })
    const itemsMap = new Map<SidebarItemId, AnyItem>([
      [folder.id, folder],
      [child.id, child],
    ])

    const selectedRoots = normalizeSelectedRoots([folder, child], itemsMap)
    const plan = planMoveTransfer({
      items: selectedRoots,
      targetParentId: null,
      graphItems: [folder, child],
    })

    expect(selectedRoots.map((selected) => selected.id)).toEqual([folder.id])
    expect(plan).toEqual([])
  })

  it('keeps unrelated selected roots and plans a real move', () => {
    const noteA = createSidebarItem('note-1', 'A')
    const noteB = createSidebarItem('note-2', 'B')
    const targetFolder = createSidebarItem('folder-1', 'Folder', RESOURCE_TYPES.folders)
    const itemsMap = new Map<SidebarItemId, AnyItem>([
      [noteA.id, noteA],
      [noteB.id, noteB],
      [targetFolder.id, targetFolder],
    ])

    const selectedRoots = normalizeSelectedRoots([noteA, noteB], itemsMap)
    const plan = planMoveTransfer({
      items: selectedRoots,
      targetParentId: targetFolder.id,
      graphItems: [targetFolder],
    })

    expect(selectedRoots.map((selected) => selected.id)).toEqual([noteA.id, noteB.id])
    expect(plan).toEqual([
      { sourceItemId: noteA.id, action: 'place', targetParentId: targetFolder.id },
      { sourceItemId: noteB.id, action: 'place', targetParentId: targetFolder.id },
    ])
  })

  it('normalizes multi-level selected descendants to the highest selected ancestor', () => {
    const grandparent = createSidebarItem('folder-1', 'Grandparent', RESOURCE_TYPES.folders)
    const parent = createSidebarItem('folder-2', 'Parent', RESOURCE_TYPES.folders, {
      parentId: grandparent.id,
    })
    const child = createSidebarItem('note-1', 'Child', RESOURCE_TYPES.notes, {
      parentId: parent.id,
    })
    const itemsMap = new Map<SidebarItemId, AnyItem>([
      [grandparent.id, grandparent],
      [parent.id, parent],
      [child.id, child],
    ])

    expect(normalizeSelectedRoots([grandparent, parent, child], itemsMap)).toEqual([grandparent])
  })

  it('throws on circular parent references during selection normalization', () => {
    const folderA = createSidebarItem('folder-1', 'A', RESOURCE_TYPES.folders, {
      parentId: 'folder-2' as SidebarItemId,
    })
    const folderB = createSidebarItem('folder-2', 'B', RESOURCE_TYPES.folders, {
      parentId: folderA.id,
    })

    expect(() =>
      normalizeSelectedRoots(
        [folderA],
        new Map<SidebarItemId, AnyItem>([
          [folderA.id, folderA],
          [folderB.id, folderB],
        ]),
      ),
    ).toThrow(/Cycle detected/)

    expect(() =>
      normalizeSelectedRoots(
        [folderA, folderB],
        new Map<SidebarItemId, AnyItem>([
          [folderA.id, folderA],
          [folderB.id, folderB],
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
      }),
    ).toEqual([])
  })

  it('ignores duplicate titles in the target collection', () => {
    const parent = createSidebarItem('folder-1', 'Parent', RESOURCE_TYPES.folders)
    const source = createSidebarItem('note-1', 'Conflict', RESOURCE_TYPES.notes, {
      parentId: parent.id,
    })
    expect(
      planMoveTransfer({
        items: [source],
        targetParentId: null,
        graphItems: [parent],
      }),
    ).toEqual([{ action: 'place', sourceItemId: source.id, targetParentId: null }])
  })

  it('plans moving an item to its current parent as a no-op', () => {
    const parent = createSidebarItem('folder-1', 'Parent', RESOURCE_TYPES.folders)
    const child = createSidebarItem('note-1', 'Child', RESOURCE_TYPES.notes, {
      parentId: parent.id,
    })

    expect(
      planMoveTransfer({
        items: [child],
        targetParentId: parent.id,
        graphItems: [parent],
      }),
    ).toEqual([])
  })
})
