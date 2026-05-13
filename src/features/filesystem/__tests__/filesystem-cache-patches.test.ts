import { beforeEach, describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_STATUS } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarCacheSnapshot } from '../filesystem-cache-patches'
import { createFileSystemCacheAdapter } from '../filesystem-cache-adapter'
import {
  applyFileSystemPatchesToSnapshot,
  invertFileSystemPatches,
} from '../filesystem-cache-patches'
import {
  buildOptimisticMovePatches,
  buildOptimisticTrashPatches,
  resetOptimisticIdIndex,
} from '../filesystem-optimistic-patches'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'

const NOW = 1000

describe('filesystem cache patches', () => {
  beforeEach(() => {
    resetOptimisticIdIndex()
  })

  it('applies and inverts update patches across sidebar and trash caches', () => {
    const folder = createFolder()
    const note = createNote()
    const patch = {
      type: 'updateSidebarItem' as const,
      itemId: note._id,
      before: { parentId: note.parentId },
      fields: { parentId: folder._id },
    }

    const moved = applyFileSystemPatchesToSnapshot({ sidebar: [folder, note], trash: [] }, [patch])
    expect(moved.sidebar.find((item) => item._id === note._id)?.parentId).toBe(folder._id)

    const restored = applyFileSystemPatchesToSnapshot(moved, invertFileSystemPatches([patch]))
    expect(restored.sidebar.find((item) => item._id === note._id)?.parentId).toBeNull()
  })

  it('uses status to place items into sidebar, trash, or neither cache', () => {
    const note = createNote()
    const trashed = { ...note, status: SIDEBAR_ITEM_STATUS.trashed }
    const hidden = { ...note, status: SIDEBAR_ITEM_STATUS.undoHidden }

    expect(
      applyFileSystemPatchesToSnapshot({ sidebar: [note], trash: [] }, [
        {
          type: 'updateSidebarItem',
          itemId: note._id,
          before: { status: note.status },
          fields: { status: trashed.status },
        },
      ]),
    ).toEqual({ sidebar: [], trash: [expect.objectContaining({ _id: note._id })] })

    expect(
      applyFileSystemPatchesToSnapshot({ sidebar: [note], trash: [] }, [
        {
          type: 'updateSidebarItem',
          itemId: note._id,
          before: { status: note.status },
          fields: { status: hidden.status },
        },
      ]),
    ).toEqual({ sidebar: [], trash: [] })
  })

  it('builds optimistic move and trash patches without mutating snapshots directly', () => {
    const folder = createFolder()
    const note = createNote()
    const snapshot: SidebarCacheSnapshot = { sidebar: [folder, note], trash: [] }
    const move = buildOptimisticMovePatches(
      snapshot,
      [{ action: 'move', sourceItemId: note._id, targetParentId: folder._id }],
      NOW,
    )
    const moved = applyFileSystemPatchesToSnapshot(snapshot, move.forwardPatches)

    expect(moved.sidebar.find((item) => item._id === note._id)?.parentId).toBe(folder._id)
    expect(snapshot.sidebar.find((item) => item._id === note._id)?.parentId).toBeNull()
    expect(
      applyFileSystemPatchesToSnapshot(moved, move.inversePatches).sidebar.find(
        (item) => item._id === note._id,
      )?.parentId,
    ).toBeNull()

    const trash = buildOptimisticTrashPatches(snapshot, [note], NOW)
    const trashed = applyFileSystemPatchesToSnapshot(snapshot, trash.forwardPatches)
    expect(trashed.trash).toEqual([
      expect.objectContaining({
        _id: note._id,
        status: SIDEBAR_ITEM_STATUS.trashed,
        deletionTime: NOW,
      }),
    ])
  })

  it('adapts lookups and patch application around active and trash cache arrays', () => {
    const folder = createFolder()
    const note = createNote()
    const trashed = createNote({ name: 'Trashed', status: SIDEBAR_ITEM_STATUS.trashed })
    let snapshot: SidebarCacheSnapshot = { sidebar: [folder, note], trash: [trashed] }
    const adapter = createFileSystemCacheAdapter({
      get: (view) => (view === 'trash' ? snapshot.trash : snapshot.sidebar),
      update: (view, updater) => {
        if (view === 'trash') {
          snapshot = { ...snapshot, trash: updater(snapshot.trash) }
        } else {
          snapshot = { ...snapshot, sidebar: updater(snapshot.sidebar) }
        }
      },
    })

    let readModel = adapter.getReadModel()
    expect(readModel.getItem(note._id)).toBe(note)
    expect(readModel.getItems([note._id, trashed._id])).toEqual([note, trashed])
    expect(readModel.getItemBySlug(note.slug)).toBe(note)
    expect(readModel.getChildren(null).map((item) => item._id)).toEqual([folder._id, note._id])

    adapter.applyPatches([
      {
        type: 'updateSidebarItem',
        itemId: note._id,
        before: { status: note.status },
        fields: { status: SIDEBAR_ITEM_STATUS.trashed },
      },
      {
        type: 'updateSidebarItem',
        itemId: trashed._id,
        before: { status: trashed.status },
        fields: { status: SIDEBAR_ITEM_STATUS.undoHidden },
      },
    ])

    readModel = adapter.getReadModel()
    expect(snapshot.sidebar).toEqual([folder])
    expect(snapshot.trash).toEqual([expect.objectContaining({ _id: note._id })])
    expect(snapshot.sidebar.find((item) => item._id === trashed._id)).toBeUndefined()
    expect(snapshot.trash.find((item) => item._id === trashed._id)).toBeUndefined()
    expect(readModel.getItem(note._id)?.status).toBe(SIDEBAR_ITEM_STATUS.trashed)
    expect(readModel.getItem(trashed._id)).toBeUndefined()
    expect(readModel.getItems([trashed._id])).toEqual([])
    expect(readModel.getItemBySlug(trashed.slug)).toBeUndefined()
  })
})
