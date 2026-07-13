import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_STATUS } from '../../workspace/items-persistence-contract'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { createFileSystemCacheAdapter } from '../cache'
import type { SidebarCacheSnapshot } from '../cache-patches'

describe('createFileSystemCacheAdapter', () => {
  it('applies active and trash changes through one snapshot replacement', () => {
    const folder = createFolder()
    const note = createNote()
    let snapshot: SidebarCacheSnapshot = { sidebar: [folder, note], trash: [] }
    const committedSnapshots: Array<SidebarCacheSnapshot> = []
    const adapter = createFileSystemCacheAdapter({
      getSnapshot: () => snapshot,
      replaceSnapshot: (updater) => {
        snapshot = updater(snapshot)
        committedSnapshots.push(snapshot)
      },
    })

    adapter.applyPatches([
      {
        type: 'updateResource',
        itemId: folder.id,
        before: { name: folder.name },
        fields: { name: 'Renamed Folder' as typeof folder.name },
      },
      {
        type: 'updateResource',
        itemId: note.id,
        before: { status: note.status },
        fields: { status: RESOURCE_STATUS.trashed },
      },
    ])

    expect(committedSnapshots).toEqual([
      {
        sidebar: [expect.objectContaining({ id: folder.id, name: 'Renamed Folder' })],
        trash: [expect.objectContaining({ id: note.id, status: RESOURCE_STATUS.trashed })],
      },
    ])
    expect(adapter.getReadModel().getItem(note.id)?.status).toBe(RESOURCE_STATUS.trashed)
  })

  it('keeps undo-hidden rows out of committed views while preserving them for redo patches', () => {
    const note = createNote()
    let snapshot: SidebarCacheSnapshot = { sidebar: [note], trash: [] }
    const adapter = createFileSystemCacheAdapter({
      getSnapshot: () => snapshot,
      replaceSnapshot: (updater) => {
        snapshot = updater(snapshot)
      },
    })

    adapter.applyPatches([
      {
        type: 'updateResource',
        itemId: note.id,
        before: { status: RESOURCE_STATUS.active },
        fields: { status: RESOURCE_STATUS.undoHidden },
      },
    ])

    expect(snapshot).toEqual({ sidebar: [], trash: [] })
    expect(adapter.getSnapshot().hidden).toEqual([expect.objectContaining({ id: note.id })])

    adapter.applyPatches([
      {
        type: 'updateResource',
        itemId: note.id,
        before: { status: RESOURCE_STATUS.undoHidden },
        fields: { status: RESOURCE_STATUS.active },
      },
    ])

    expect(snapshot).toEqual({
      sidebar: [expect.objectContaining({ id: note.id, status: RESOURCE_STATUS.active })],
      trash: [],
    })
    expect(adapter.getSnapshot()).not.toHaveProperty('hidden')
  })

  it('returns a stable snapshot without mutating hidden state during reads', () => {
    const note = createNote()
    let snapshot: SidebarCacheSnapshot = { sidebar: [note], trash: [] }
    const adapter = createFileSystemCacheAdapter({
      getSnapshot: () => snapshot,
      replaceSnapshot: (updater) => {
        snapshot = updater(snapshot)
      },
    })
    adapter.applyPatches([
      {
        type: 'updateResource',
        itemId: note.id,
        before: { status: RESOURCE_STATUS.active },
        fields: { status: RESOURCE_STATUS.undoHidden },
      },
    ])

    const first = adapter.getSnapshot()
    expect(adapter.getSnapshot()).toBe(first)
  })
})
