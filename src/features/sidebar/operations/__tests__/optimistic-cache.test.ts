import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import {
  applyOptimisticDuplicateOperationsToSnapshot,
  applyOptimisticMoveOperationsToSnapshot,
} from '../optimistic-cache'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'

describe('optimistic sidebar operation cache transforms', () => {
  it('moves an active item to another parent', () => {
    const folder = createFolder({ name: 'Folder' })
    const note = createNote({ name: 'Note' })

    const next = applyOptimisticMoveOperationsToSnapshot(
      { sidebar: [folder, note], trash: [] },
      [{ action: 'move', sourceItemId: note._id, targetParentId: folder._id }],
      1000,
    )

    expect(next.sidebar.find((item) => item._id === note._id)?.parentId).toBe(folder._id)
    expect(next.trash).toEqual([])
  })

  it('restores a trashed folder and descendants', () => {
    const folder = createFolder({
      name: 'Folder',
      location: SIDEBAR_ITEM_LOCATION.trash,
      parentId: null,
      deletionTime: 900,
    })
    const child = createNote({
      name: 'Child',
      location: SIDEBAR_ITEM_LOCATION.trash,
      parentId: folder._id,
      deletionTime: 900,
    })
    const targetParentId = 'folder-target' as Id<'sidebarItems'>

    const next = applyOptimisticMoveOperationsToSnapshot(
      { sidebar: [], trash: [folder, child] },
      [{ action: 'move', sourceItemId: folder._id, targetParentId }],
      1000,
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
      1000,
    )

    expect(next.sidebar.map((item) => item._id)).toEqual([source._id])
    expect(next.trash.map((item) => item._id)).toEqual([destination._id, destinationChild._id])
    expect(next.trash[0]).toMatchObject({
      parentId: null,
      location: SIDEBAR_ITEM_LOCATION.trash,
      deletionTime: 1000,
    })
  })

  it('duplicates a folder tree with temporary ids', () => {
    const folder = createFolder({ name: 'Folder' })
    const child = createNote({ name: 'Child', parentId: folder._id })
    const targetParentId = 'folder-target' as Id<'sidebarItems'>

    const next = applyOptimisticDuplicateOperationsToSnapshot(
      { sidebar: [folder, child], trash: [] },
      [{ action: 'copy', sourceItemId: folder._id, targetParentId, name: 'Folder Copy' }],
      1000,
    )

    const clones = next.sidebar.filter((item) => item._id.toString().startsWith('optimistic-'))
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
      [{ action: 'mergeFolder', sourceItemId: source._id, destinationItemId: destination._id }],
      1000,
    )

    expect(next.sidebar).toEqual([source, destination])
    expect(next.trash).toEqual([])
  })
})
