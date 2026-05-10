import { beforeEach, describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import {
  OPTIMISTIC_ID_PREFIX,
  applyOptimisticDuplicateOperationsToSnapshot,
  applyOptimisticMoveOperationsToSnapshot,
  applyOptimisticTrashItemsToSnapshot,
  resetOptimisticIdIndex,
} from '../optimistic-cache'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'

const MOVE_TS = 1000
const DELETION_TS = 900

describe('optimistic sidebar operation cache transforms', () => {
  beforeEach(() => {
    resetOptimisticIdIndex()
  })

  it('moves an active item to another parent', () => {
    const folder = createFolder({ name: 'Folder' })
    const note = createNote({ name: 'Note' })

    const next = applyOptimisticMoveOperationsToSnapshot(
      { sidebar: [folder, note], trash: [] },
      [{ action: 'move', sourceItemId: note._id, targetParentId: folder._id }],
      MOVE_TS,
    )

    const movedItem = next.sidebar.find((item) => item._id === note._id)
    expect(movedItem).toBeDefined()
    expect(movedItem?.parentId).toBe(folder._id)
    expect(next.trash).toEqual([])
  })

  it('restores a trashed folder and descendants', () => {
    const folder = createFolder({
      name: 'Folder',
      location: SIDEBAR_ITEM_LOCATION.trash,
      parentId: null,
      deletionTime: DELETION_TS,
    })
    const child = createNote({
      name: 'Child',
      location: SIDEBAR_ITEM_LOCATION.trash,
      parentId: folder._id,
      deletionTime: DELETION_TS,
    })
    const targetParentId = 'folder-target' as Id<'sidebarItems'>

    const next = applyOptimisticMoveOperationsToSnapshot(
      { sidebar: [], trash: [folder, child] },
      [{ action: 'move', sourceItemId: folder._id, targetParentId }],
      MOVE_TS,
    )

    expect(next.trash).toEqual([])
    expect(next.sidebar).toEqual([
      expect.objectContaining({
        _id: folder._id,
        parentId: targetParentId,
        location: SIDEBAR_ITEM_LOCATION.sidebar,
        deletionTime: null,
      }),
      expect.objectContaining({
        _id: child._id,
        parentId: folder._id,
        location: SIDEBAR_ITEM_LOCATION.sidebar,
        deletionTime: null,
      }),
    ])
  })

  it('trashes a replaced destination tree', () => {
    const source = createNote({ name: 'Source' })
    const destination = createFolder({ name: 'Destination' })
    const destinationChild = createNote({ name: 'Child', parentId: destination._id })

    const next = applyOptimisticMoveOperationsToSnapshot(
      { sidebar: [source, destination, destinationChild], trash: [] },
      [
        {
          action: 'replace',
          sourceItemId: source._id,
          targetParentId: null,
          destinationItemId: destination._id,
          name: 'Destination',
        },
      ],
      MOVE_TS,
    )

    expect(next.sidebar.map((item) => item._id)).toEqual([source._id])
    const movedSource = next.sidebar.find((item) => item._id === source._id)
    expect(movedSource).toMatchObject({ parentId: null, name: 'Destination' })
    expect(next.trash.map((item) => item._id)).toEqual([destination._id, destinationChild._id])
    expect(next.trash[0]).toMatchObject({
      parentId: null,
      location: SIDEBAR_ITEM_LOCATION.trash,
      deletionTime: MOVE_TS,
    })
    expect(next.trash[1]).toMatchObject({
      parentId: destination._id,
      location: SIDEBAR_ITEM_LOCATION.trash,
      deletionTime: MOVE_TS,
    })
  })

  it('duplicates a folder tree with temporary ids', () => {
    const folder = createFolder({ name: 'Folder' })
    const child = createNote({ name: 'Child', parentId: folder._id })
    const targetParentId = 'folder-target' as Id<'sidebarItems'>

    const next = applyOptimisticDuplicateOperationsToSnapshot(
      { sidebar: [folder, child], trash: [] },
      [{ action: 'copy', sourceItemId: folder._id, targetParentId, name: 'Folder Copy' }],
      MOVE_TS,
    )

    const originals = next.sidebar.filter(
      (item) => item._id === folder._id || item._id === child._id,
    )
    const clones = next.sidebar.filter((item) =>
      item._id.toString().startsWith(OPTIMISTIC_ID_PREFIX),
    )
    expect(originals).toEqual([folder, child])
    expect(clones).toHaveLength(2)
    expect(clones[0]).toMatchObject({
      name: 'Folder Copy',
      parentId: targetParentId,
      type: SIDEBAR_ITEM_TYPES.folders,
    })
    expect(clones[1]).toMatchObject({
      name: 'Child',
      parentId: clones[0]._id,
      type: SIDEBAR_ITEM_TYPES.notes,
    })
  })

  it('does not clone or move the source for merge folder operations', () => {
    const source = createFolder({ name: 'Folder' })
    const destination = createFolder({ name: 'Folder' })

    const next = applyOptimisticDuplicateOperationsToSnapshot(
      { sidebar: [source, destination], trash: [] },
      [
        {
          action: 'mergeFolder',
          sourceItemId: source._id,
          destinationItemId: destination._id,
          targetParentId: null,
        },
      ],
      MOVE_TS,
    )

    expect(next.sidebar).toHaveLength(2)
    expect(next.sidebar).toEqual(expect.arrayContaining([source, destination]))
    expect(next.trash).toEqual([])
  })

  it('ignores move and duplicate operations whose source item is missing', () => {
    const note = createNote()
    const missingId = 'missing' as Id<'sidebarItems'>

    const moved = applyOptimisticMoveOperationsToSnapshot(
      { sidebar: [note], trash: [] },
      [{ action: 'move', sourceItemId: missingId, targetParentId: null }],
      MOVE_TS,
    )
    const duplicated = applyOptimisticDuplicateOperationsToSnapshot(
      { sidebar: [note], trash: [] },
      [{ action: 'copy', sourceItemId: missingId, targetParentId: null, name: 'Copy' }],
      MOVE_TS,
    )

    expect(moved).toEqual({ sidebar: [note], trash: [] })
    expect(duplicated).toEqual({ sidebar: [note], trash: [] })
  })

  it('handles empty snapshots without throwing', () => {
    const missingId = 'missing' as Id<'sidebarItems'>

    expect(
      applyOptimisticMoveOperationsToSnapshot(
        { sidebar: [], trash: [] },
        [{ action: 'move', sourceItemId: missingId, targetParentId: null }],
        MOVE_TS,
      ),
    ).toEqual({ sidebar: [], trash: [] })
    expect(applyOptimisticTrashItemsToSnapshot({ sidebar: [], trash: [] }, [], MOVE_TS)).toEqual({
      sidebar: [],
      trash: [],
    })
  })

  it('applies multiple move operations in one pass', () => {
    const folder = createFolder()
    const first = createNote()
    const second = createNote()

    const next = applyOptimisticMoveOperationsToSnapshot(
      { sidebar: [folder, first, second], trash: [] },
      [
        { action: 'move', sourceItemId: first._id, targetParentId: folder._id },
        { action: 'move', sourceItemId: second._id, targetParentId: folder._id },
      ],
      MOVE_TS,
    )

    expect(next.sidebar).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: first._id, parentId: folder._id }),
        expect.objectContaining({ _id: second._id, parentId: folder._id }),
      ]),
    )
  })

  it('preserves deletedBy on optimistic trash when caller provides it', () => {
    const note = createNote()
    const deletedBy = 'profile_1' as Id<'userProfiles'>

    const next = applyOptimisticTrashItemsToSnapshot(
      { sidebar: [note], trash: [] },
      [note],
      MOVE_TS,
      deletedBy,
    )

    expect(next.trash).toEqual([
      expect.objectContaining({
        _id: note._id,
        deletedBy,
        deletionTime: MOVE_TS,
        location: SIDEBAR_ITEM_LOCATION.trash,
      }),
    ])
  })
})
