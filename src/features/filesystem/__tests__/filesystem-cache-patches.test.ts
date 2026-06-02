import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_STATUS } from 'shared/sidebar-items/types'
import type { SidebarCacheSnapshot } from '../filesystem-cache-patches'
import { createFileSystemCacheAdapter } from '../filesystem-cache-adapter'
import { applyFileSystemPatchesToSidebarCache } from '../filesystem-cache-patches'
import { OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX } from '../optimistic-sidebar-items'
import {
  projectMoveOperations,
  projectTrashRoots,
} from 'shared/sidebar-items/filesystem/patch-projection'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'

const NOW = 1000

function rawSidebarRow(item: ReturnType<typeof createNote>) {
  const {
    shares: _shares,
    isBookmarked: _isBookmarked,
    myPermissionLevel: _myPermissionLevel,
    previewUrl: _previewUrl,
    isActive: _isActive,
    isTrashed: _isTrashed,
    ...row
  } = item
  return row
}

describe('filesystem cache patches', () => {
  it('applies update patches across sidebar and trash caches', () => {
    const folder = createFolder()
    const note = createNote()
    const patch = {
      type: 'updateSidebarItem' as const,
      itemId: note._id,
      before: { parentId: note.parentId },
      fields: { parentId: folder._id },
    }

    const moved = applyFileSystemPatchesToSidebarCache({ sidebar: [folder, note], trash: [] }, [
      patch,
    ])
    expect(moved.sidebar.find((item) => item._id === note._id)?.parentId).toBe(folder._id)
  })

  it('uses status to place items into sidebar, trash, or neither cache', () => {
    const note = createNote()
    const trashed = { ...note, status: SIDEBAR_ITEM_STATUS.trashed }
    const hidden = { ...note, status: SIDEBAR_ITEM_STATUS.undoHidden }

    expect(
      applyFileSystemPatchesToSidebarCache({ sidebar: [note], trash: [] }, [
        {
          type: 'updateSidebarItem',
          itemId: note._id,
          before: { status: note.status },
          fields: { status: trashed.status },
        },
      ]),
    ).toEqual({ sidebar: [], trash: [expect.objectContaining({ _id: note._id })] })

    expect(
      applyFileSystemPatchesToSidebarCache({ sidebar: [note], trash: [] }, [
        {
          type: 'updateSidebarItem',
          itemId: note._id,
          before: { status: note.status },
          fields: { status: hidden.status },
        },
      ]),
    ).toEqual({ sidebar: [], trash: [] })
  })

  it('treats missing undo-hidden updates as already reconciled by active and trash subscriptions', () => {
    const note = createNote()

    expect(
      applyFileSystemPatchesToSidebarCache({ sidebar: [], trash: [] }, [
        {
          type: 'updateSidebarItem',
          itemId: note._id,
          before: { status: note.status },
          fields: { status: SIDEBAR_ITEM_STATUS.undoHidden },
        },
      ]),
    ).toEqual({ sidebar: [], trash: [] })

    expect(() =>
      applyFileSystemPatchesToSidebarCache({ sidebar: [], trash: [] }, [
        {
          type: 'updateSidebarItem',
          itemId: note._id,
          before: { name: note.name },
          fields: { name: 'Renamed' as typeof note.name },
        },
      ]),
    ).toThrow(/missing sidebar item/)
  })

  it('does not insert raw authoritative rows that have not arrived through sidebar queries', () => {
    const note = createNote()

    expect(
      applyFileSystemPatchesToSidebarCache({ sidebar: [], trash: [] }, [
        { type: 'upsertSidebarItem', item: rawSidebarRow(note) },
      ]),
    ).toEqual({ sidebar: [], trash: [] })
  })

  it('keeps optimistic and restored cache rows without fabricating authoritative query fields', () => {
    const note = createNote()
    const optimistic = {
      ...note,
      _id: `${OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX}1` as typeof note._id,
    }
    const withOptimistic = applyFileSystemPatchesToSidebarCache({ sidebar: [], trash: [] }, [
      { type: 'upsertSidebarItem', item: optimistic },
    ])

    expect(withOptimistic.sidebar).toEqual([expect.objectContaining({ _id: optimistic._id })])

    const restored = applyFileSystemPatchesToSidebarCache({ sidebar: [], trash: [] }, [
      { type: 'upsertSidebarItem', item: note },
    ])
    expect(restored.sidebar).toEqual([expect.objectContaining({ _id: note._id })])
  })

  it('keeps optimistic rows while applying authoritative updates for existing rows', () => {
    const existing = createNote({ name: 'Existing' })
    const created = createNote({ name: 'Created' })
    const optimistic = {
      ...created,
      _id: `${OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX}created` as typeof created._id,
    }

    const updated = applyFileSystemPatchesToSidebarCache(
      { sidebar: [existing, optimistic], trash: [] },
      [
        {
          type: 'updateSidebarItem',
          itemId: existing._id,
          before: { name: existing.name },
          fields: { name: 'Renamed Existing' as typeof existing.name },
        },
        { type: 'upsertSidebarItem', item: rawSidebarRow(created) },
      ],
    )

    expect(updated.sidebar).toEqual([
      expect.objectContaining({ _id: existing._id, name: 'Renamed Existing' }),
      expect.objectContaining({ _id: optimistic._id }),
    ])
  })

  it('builds optimistic move and trash patches without mutating snapshots directly', () => {
    const folder = createFolder()
    const note = createNote()
    const snapshot: SidebarCacheSnapshot = { sidebar: [folder, note], trash: [] }
    const move = projectMoveOperations({
      activeItems: snapshot.sidebar,
      trashItems: snapshot.trash,
      operations: [{ action: 'place', sourceItemId: note._id, targetParentId: folder._id }],
      now: NOW,
    })
    const moved = applyFileSystemPatchesToSidebarCache(snapshot, move.forwardPatches)

    expect(moved.sidebar.find((item) => item._id === note._id)?.parentId).toBe(folder._id)
    expect(snapshot.sidebar.find((item) => item._id === note._id)?.parentId).toBeNull()
    expect(
      applyFileSystemPatchesToSidebarCache(moved, move.inversePatches).sidebar.find(
        (item) => item._id === note._id,
      )?.parentId,
    ).toBeNull()

    const trash = projectTrashRoots(snapshot.sidebar, [note._id], {
      now: NOW,
      userId: null,
    })
    const trashed = applyFileSystemPatchesToSidebarCache(snapshot, trash.forwardPatches)
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
    expect(readModel.getActiveChildren(null).map((item) => item._id)).toEqual([
      folder._id,
      note._id,
    ])

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
