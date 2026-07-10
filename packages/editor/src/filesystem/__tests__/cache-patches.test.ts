import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_STATUS } from '../../workspace/items-persistence-contract'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { SidebarCacheSnapshot } from '../cache-patches'
import { createFileSystemCacheAdapter } from '../cache'
import {
  applyFileSystemPatchesToSidebarCache,
  resourcePatchRowFromCacheItem,
} from '../cache-patches'
import { createWorkspaceResourceReadModel } from '../../workspace/items'
import { OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX } from '../../workspace/items/optimistic'
import { projectMoveOperations, projectTrashRoots } from '../domain/patch-projection'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import type { ResourcePatch } from '../patch-contract'
import type { SidebarItemShareId, WorkspaceMemberId } from '../../../../../shared/common/ids'

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

type SidebarItemSharePatchRow = Extract<ResourcePatch, { type: 'upsertResourceShare' }>['share']

function createShare(
  item: ReturnType<typeof createNote>,
  overrides?: Partial<SidebarItemSharePatchRow>,
): SidebarItemSharePatchRow {
  return {
    id: `share_${item.id}` as SidebarItemShareId,
    createdAt: 1,
    workspaceId: item.campaignId,
    resourceId: item.id,
    sidebarItemType: item.type,
    memberId: 'member_1' as WorkspaceMemberId,
    sessionId: null,
    permissionLevel: PERMISSION_LEVEL.VIEW,
    ...overrides,
  }
}

describe('filesystem cache patches', () => {
  it('applies update patches across sidebar and trash caches', () => {
    const folder = createFolder()
    const note = createNote()
    const patch = {
      type: 'updateResource' as const,
      itemId: note.id,
      before: { parentId: note.parentId },
      fields: { parentId: folder.id },
    }

    const moved = applyFileSystemPatchesToSidebarCache({ sidebar: [folder, note], trash: [] }, [
      patch,
    ])
    expect(moved.sidebar.find((item) => item.id === note.id)?.parentId).toBe(folder.id)
  })

  it('uses status to place items into the trash cache', () => {
    const note = createNote()
    const trashed = { ...note, status: RESOURCE_STATUS.trashed }

    const projected = applyFileSystemPatchesToSidebarCache({ sidebar: [note], trash: [] }, [
      {
        type: 'updateResource',
        itemId: note.id,
        before: { status: note.status },
        fields: { status: trashed.status },
      },
    ])
    expect(projected.trash).toEqual([expect.objectContaining({ id: note.id })])
  })

  it('does not materialize raw upsert rows without sidebar cache fields', () => {
    const note = createNote()
    const row = resourcePatchRowFromCacheItem(note)
    const snapshot: SidebarCacheSnapshot = { sidebar: [], trash: [] }

    expect(row).not.toHaveProperty('shares')
    expect(row).not.toHaveProperty('isBookmarked')
    expect(row).not.toHaveProperty('myPermissionLevel')
    expect(row).not.toHaveProperty('previewUrl')

    const restored = applyFileSystemPatchesToSidebarCache(snapshot, [
      { type: 'upsertResource', item: row },
    ])
    expect(restored).toEqual(snapshot)
  })

  it('does not materialize unknown-permission optimistic rows as full-access cache items', () => {
    const created = createNote({ name: 'Created' })
    const optimistic = {
      ...rawSidebarRow(created),
      id: `${OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX}created` as typeof created.id,
    }
    const snapshot: SidebarCacheSnapshot = { sidebar: [], trash: [] }

    const updated = applyFileSystemPatchesToSidebarCache(snapshot, [
      { type: 'upsertResource', item: resourcePatchRowFromCacheItem(optimistic) },
    ])

    expect(updated).toEqual(snapshot)
  })

  it('keeps optimistic rows while applying authoritative updates for existing rows', () => {
    const existing = createNote({ name: 'Existing' })
    const created = createNote({ name: 'Created' })
    const optimistic = {
      ...created,
      id: `${OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX}created` as typeof created.id,
    }

    const updated = applyFileSystemPatchesToSidebarCache(
      { sidebar: [existing, optimistic], trash: [] },
      [
        {
          type: 'updateResource',
          itemId: existing.id,
          before: { name: existing.name },
          fields: { name: 'Renamed Existing' as typeof existing.name },
        },
        { type: 'upsertResource', item: resourcePatchRowFromCacheItem(rawSidebarRow(created)) },
      ],
    )

    expect(updated.sidebar).toEqual([
      expect.objectContaining({ id: existing.id, name: 'Renamed Existing' }),
      expect.objectContaining({ id: optimistic.id }),
    ])
  })

  it('keeps undo-hidden created rows available for redo receipt updates', () => {
    const created = createNote({ name: 'Created' })

    const undone = applyFileSystemPatchesToSidebarCache({ sidebar: [created], trash: [] }, [
      {
        type: 'updateResource',
        itemId: created.id,
        before: { status: RESOURCE_STATUS.active },
        fields: { status: RESOURCE_STATUS.undoHidden },
      },
    ])

    expect(undone.sidebar).toEqual([])
    expect(undone.trash).toEqual([])
    expect(undone.hidden).toEqual([expect.objectContaining({ id: created.id })])

    const redone = applyFileSystemPatchesToSidebarCache(undone, [
      {
        type: 'updateResource',
        itemId: created.id,
        before: { status: RESOURCE_STATUS.undoHidden },
        fields: { status: RESOURCE_STATUS.active },
      },
    ])

    expect(redone).not.toHaveProperty('hidden')
    expect(redone.sidebar).toEqual([expect.objectContaining({ id: created.id })])
    expect(redone.sidebar[0]).toMatchObject({
      shares: created.shares,
      isBookmarked: created.isBookmarked,
      myPermissionLevel: created.myPermissionLevel,
      previewUrl: created.previewUrl,
    })
  })

  it('preserves visible cache snapshots when update patches target off-screen items', () => {
    const visible = createNote({ name: 'Visible' })
    const offscreen = createNote({ name: 'Offscreen' })
    const snapshot: SidebarCacheSnapshot = { sidebar: [visible], trash: [] }

    const updated = applyFileSystemPatchesToSidebarCache(snapshot, [
      {
        type: 'updateResource',
        itemId: offscreen.id,
        before: { name: offscreen.name },
        fields: { name: 'Renamed Offscreen' as typeof offscreen.name },
      },
    ])

    expect(updated).toEqual(snapshot)
  })

  it('applies sidebar item share patches to cached item shares', () => {
    const note = createNote()
    const share = createShare(note)
    const shared = applyFileSystemPatchesToSidebarCache({ sidebar: [note], trash: [] }, [
      { type: 'upsertResourceShare', share },
    ])

    expect(shared.sidebar[0]?.shares).toEqual([
      expect.objectContaining({
        id: share.id,
        campaignId: share.workspaceId,
        campaignMemberId: share.memberId,
        permissionLevel: share.permissionLevel,
      }),
    ])

    const updated = applyFileSystemPatchesToSidebarCache(shared, [
      {
        type: 'updateResourceShare',
        resourceId: note.id,
        memberId: share.memberId,
        before: { permissionLevel: share.permissionLevel },
        fields: { permissionLevel: PERMISSION_LEVEL.EDIT },
      },
    ])

    expect(updated.sidebar[0]?.shares).toEqual([
      expect.objectContaining({ id: share.id, permissionLevel: PERMISSION_LEVEL.EDIT }),
    ])

    const removed = applyFileSystemPatchesToSidebarCache(updated, [
      { type: 'removeResourceShare', share },
    ])

    expect(removed.sidebar[0]?.shares).toEqual([])
  })

  it('applies folder share patches to cached folder inheritance state', () => {
    const folder = createFolder({ inheritShares: true })

    const updated = applyFileSystemPatchesToSidebarCache({ sidebar: [folder], trash: [] }, [
      {
        type: 'updateFolderShare',
        folderId: folder.id,
        before: { inheritShares: true },
        fields: { inheritShares: false },
      },
    ])

    expect(updated.sidebar[0]).toEqual(expect.objectContaining({ inheritShares: false }))
  })

  it('builds optimistic move and trash patch projections from cache snapshots', () => {
    const folder = createFolder()
    const note = createNote()
    const snapshot: SidebarCacheSnapshot = { sidebar: [folder, note], trash: [] }
    const move = projectMoveOperations({
      activeItems: snapshot.sidebar.map(resourcePatchRowFromCacheItem),
      trashItems: snapshot.trash.map(resourcePatchRowFromCacheItem),
      operations: [{ action: 'place', sourceItemId: note.id, targetParentId: folder.id }],
      now: NOW,
      userId: null,
    })
    const moved = applyFileSystemPatchesToSidebarCache(snapshot, move.forwardPatches)

    expect(moved.sidebar.find((item) => item.id === note.id)?.parentId).toBe(folder.id)
    expect(
      createWorkspaceResourceReadModel(snapshot.sidebar)
        .getActiveChildren(null)
        .map((item) => item.id),
    ).toEqual([folder.id, note.id])
    expect(
      createWorkspaceResourceReadModel(
        applyFileSystemPatchesToSidebarCache(moved, move.inversePatches).sidebar,
      )
        .getActiveChildren(null)
        .map((item) => item.id),
    ).toEqual([folder.id, note.id])

    const trash = projectTrashRoots(
      snapshot.sidebar.map(resourcePatchRowFromCacheItem),
      [note.id],
      {
        now: NOW,
        userId: null,
      },
    )
    const trashed = applyFileSystemPatchesToSidebarCache(snapshot, trash.forwardPatches)
    expect(trashed.trash).toEqual([
      expect.objectContaining({
        id: note.id,
        status: RESOURCE_STATUS.trashed,
        deletionTime: NOW,
      }),
    ])
  })

  it('keeps resolved replacement names when restoring from trash', () => {
    const destination = createNote({ name: 'Scene' })
    const trashed = createNote({ name: 'Scene', status: RESOURCE_STATUS.trashed })
    const snapshot: SidebarCacheSnapshot = { sidebar: [destination], trash: [trashed] }

    const replace = projectMoveOperations({
      activeItems: snapshot.sidebar.map(resourcePatchRowFromCacheItem),
      trashItems: snapshot.trash.map(resourcePatchRowFromCacheItem),
      operations: [
        {
          action: 'replace',
          sourceItemId: trashed.id,
          targetParentId: null,
          destinationItemId: destination.id,
          name: 'Scene 1',
        },
      ],
      now: NOW,
      userId: null,
    })
    const applied = applyFileSystemPatchesToSidebarCache(snapshot, replace.forwardPatches)

    expect(applied.sidebar).toEqual([
      expect.objectContaining({
        id: trashed.id,
        name: 'Scene 1',
        status: RESOURCE_STATUS.active,
      }),
    ])
    expect(applied.trash).toEqual([expect.objectContaining({ id: destination.id })])
  })

  it('trashes a merged source folder after projected child moves empty it', () => {
    const sourceFolder = createFolder({ name: 'Source' })
    const destinationFolder = createFolder({ name: 'Destination' })
    const child = createNote({ name: 'Child', parentId: sourceFolder.id })
    const snapshot: SidebarCacheSnapshot = {
      sidebar: [sourceFolder, destinationFolder, child],
      trash: [],
    }

    const merge = projectMoveOperations({
      activeItems: snapshot.sidebar.map(resourcePatchRowFromCacheItem),
      trashItems: snapshot.trash.map(resourcePatchRowFromCacheItem),
      operations: [
        { action: 'place', sourceItemId: child.id, targetParentId: destinationFolder.id },
        {
          action: 'mergeFolder',
          sourceItemId: sourceFolder.id,
          targetParentId: null,
          destinationItemId: destinationFolder.id,
        },
      ],
      now: NOW,
      userId: null,
    })
    const applied = applyFileSystemPatchesToSidebarCache(snapshot, merge.forwardPatches)
    const readModel = createWorkspaceResourceReadModel(applied.sidebar)

    expect(readModel.getActiveChildren(destinationFolder.id).map((item) => item.id)).toEqual([
      child.id,
    ])
    expect(applied.trash).toEqual([
      expect.objectContaining({
        id: sourceFolder.id,
        status: RESOURCE_STATUS.trashed,
      }),
    ])
  })

  it('adapts lookups and patch application around active and trash cache arrays', () => {
    const folder = createFolder()
    const note = createNote()
    const trashed = createNote({ name: 'Trashed', status: RESOURCE_STATUS.trashed })
    let snapshot: SidebarCacheSnapshot = { sidebar: [folder, note], trash: [trashed] }
    const adapter = createFileSystemCacheAdapter({
      getSnapshot: () => snapshot,
      replaceSnapshot: (updater) => {
        snapshot = updater(snapshot)
      },
    })

    let readModel = adapter.getReadModel()
    expect(readModel.getItem(note.id)).toBe(note)
    expect(readModel.getItems([note.id, trashed.id])).toEqual([note, trashed])
    expect(readModel.getItemBySlug(note.slug)).toBe(note)
    expect(readModel.getActiveChildren(null).map((item) => item.id)).toEqual([folder.id, note.id])

    adapter.applyPatches([
      {
        type: 'updateResource',
        itemId: note.id,
        before: { status: note.status },
        fields: { status: RESOURCE_STATUS.trashed },
      },
      {
        type: 'updateResource',
        itemId: trashed.id,
        before: { status: trashed.status },
        fields: { status: RESOURCE_STATUS.undoHidden },
      },
    ])

    readModel = adapter.getReadModel()
    expect(snapshot.sidebar).toEqual([folder])
    expect(snapshot.trash).toEqual([expect.objectContaining({ id: note.id })])
    expect(readModel.getActiveChildren(null).map((item) => item.id)).toEqual([folder.id])
    expect(readModel.getItem(note.id)?.status).toBe(RESOURCE_STATUS.trashed)
  })

  it('rebuilds read models after backing cache arrays refresh', () => {
    const oldNote = createNote({ name: 'Old' })
    const refreshedNote = createNote({ name: 'Refreshed' })
    let snapshot: SidebarCacheSnapshot = { sidebar: [oldNote], trash: [] }
    const adapter = createFileSystemCacheAdapter({
      getSnapshot: () => snapshot,
      replaceSnapshot: (updater) => {
        snapshot = updater(snapshot)
      },
    })

    expect(adapter.getReadModel().getItem(oldNote.id)).toBe(oldNote)

    snapshot = { sidebar: [refreshedNote], trash: [] }

    expect(adapter.getSnapshot().sidebar).toEqual([refreshedNote])
    const refreshedReadModel = adapter.getReadModel()
    expect(refreshedReadModel.getActiveChildren(null).map((item) => item.id)).toEqual([
      refreshedNote.id,
    ])
    expect(refreshedReadModel.getItem(refreshedNote.id)).toBe(refreshedNote)
  })
})
