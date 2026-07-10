import { describe, expect, it } from 'vite-plus/test'
import { planFileSystemOptimisticCommand } from '../optimistic-planner'
import { applyFileSystemPatchesToSidebarCache } from '../cache-patches'
import { createFileSystemCacheAdapter } from '../cache'
import type { SidebarCacheSnapshot } from '../cache-patches'
import { assertResourceItemName, createWorkspaceResourceReadModel } from '../../workspace/items'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { RESOURCE_STATUS, RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { CampaignId, UserProfileId } from '../../../../../shared/common/ids'

const campaignId = 'campaign' as CampaignId
const userId = 'user_1' as UserProfileId

function createTestCache(snapshot: SidebarCacheSnapshot) {
  const adapter = createFileSystemCacheAdapter({
    getSnapshot: () => snapshot,
    replaceSnapshot: () => {},
  })
  return {
    snapshot,
    readModel: adapter.getReadModel(),
  }
}

describe('filesystem optimistic planning', () => {
  it('models create as a passive item insert with parent-folder visibility', () => {
    const parent = createFolder({ name: 'Scenes' })
    const snapshot: SidebarCacheSnapshot = { sidebar: [parent], trash: [] }
    const cache = createTestCache(snapshot)

    const plan = planFileSystemOptimisticCommand({
      command: {
        type: 'create',
        itemType: RESOURCE_TYPES.notes,
        name: assertResourceItemName('Scene'),
        parentTarget: { kind: 'direct', parentId: parent.id },
      },
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: null },
      currentUserId: userId,
      workspaceId: campaignId,
    })

    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    const upsert = plan.preview.receiptPatches[0]
    expect(upsert?.type).toBe('upsertResource')
    if (upsert?.type !== 'upsertResource') return
    expect(plan.preview.optimisticIntents).toEqual([
      { type: 'openFolder', workspaceId: campaignId, folderId: parent.id },
    ])
  })

  it('models creates under existing path parents through the package parent planner', () => {
    const parent = createFolder({ name: 'Scenes' })
    const existing = createNote({ name: 'Scene', parentId: parent.id })
    const snapshot: SidebarCacheSnapshot = { sidebar: [parent, existing], trash: [] }
    const cache = createTestCache(snapshot)

    const plan = planFileSystemOptimisticCommand({
      command: {
        type: 'create',
        itemType: RESOURCE_TYPES.notes,
        name: assertResourceItemName('Scene'),
        parentTarget: { kind: 'path', baseParentId: null, pathSegments: ['Scenes'] },
      },
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: null },
      currentUserId: userId,
      workspaceId: campaignId,
    })

    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    const applied = applyFileSystemPatchesToSidebarCache(snapshot, plan.preview.receiptPatches)
    const appliedReadModel = createWorkspaceResourceReadModel([
      ...applied.sidebar,
      ...applied.trash,
    ])
    const children = appliedReadModel.getActiveChildren(parent.id)
    expect(children.map((item) => item.name)).toEqual(['Scene', 'Scene 1'])
    expect(plan.preview.optimisticIntents).toEqual([
      { type: 'openFolder', workspaceId: campaignId, folderId: parent.id },
    ])
  })

  it('uses the execution-owned parent plan for optimistic create previews', () => {
    const parent = createFolder({ name: 'Pending parent' })
    const snapshot: SidebarCacheSnapshot = { sidebar: [parent], trash: [] }
    const cache = createTestCache(snapshot)

    const plan = planFileSystemOptimisticCommand({
      command: {
        type: 'create',
        itemType: RESOURCE_TYPES.notes,
        name: assertResourceItemName('Scene'),
        parentTarget: { kind: 'path', baseParentId: null, pathSegments: ['Pending parent'] },
      },
      createParentPlan: { kind: 'path', folders: [{ kind: 'existing', id: parent.id }] },
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: null },
      currentUserId: userId,
      workspaceId: campaignId,
    })

    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    expect(plan.preview.receiptPatches).toEqual([
      expect.objectContaining({
        type: 'upsertResource',
        item: expect.objectContaining({ parentId: parent.id }),
      }),
    ])
  })

  it('reserves names and slugs from pending optimistic creates', () => {
    const parent = createFolder({ name: 'Scenes' })
    const pending = createNote({ name: 'Scene', slug: 'scene', parentId: parent.id })
    const snapshot: SidebarCacheSnapshot = { sidebar: [parent, pending], trash: [] }
    const cache = createTestCache(snapshot)

    const plan = planFileSystemOptimisticCommand({
      command: {
        type: 'create',
        itemType: RESOURCE_TYPES.notes,
        name: assertResourceItemName('Scene'),
        parentTarget: { kind: 'direct', parentId: parent.id },
      },
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: null },
      currentUserId: userId,
      workspaceId: campaignId,
    })

    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    const upsert = plan.preview.receiptPatches[0]
    expect(upsert?.type).toBe('upsertResource')
    if (upsert?.type !== 'upsertResource') return
    expect(upsert.item).toEqual(expect.objectContaining({ name: 'Scene 1', slug: 'scene-1' }))
  })

  it('populates concrete type fields for optimistic create previews', () => {
    const snapshot: SidebarCacheSnapshot = { sidebar: [], trash: [] }
    const cache = createTestCache(snapshot)
    const cases = [
      [RESOURCE_TYPES.folders, { inheritShares: true }],
      [RESOURCE_TYPES.files, { assetId: null, downloadUrl: null, contentType: null }],
      [RESOURCE_TYPES.gameMaps, { imageAssetId: null, imageUrl: null }],
    ] as const

    for (const [itemType, expectedFields] of cases) {
      const plan = planFileSystemOptimisticCommand({
        command: {
          type: 'create',
          itemType,
          name: assertResourceItemName('Created'),
          parentTarget: { kind: 'direct', parentId: null },
        },
        snapshot: cache.snapshot,
        readModel: cache.readModel,
        activeItemSurface: { parentId: null },
        currentUserId: userId,
        workspaceId: campaignId,
      })

      expect(plan.status).toBe('ready')
      if (plan.status !== 'ready') continue
      const upsert = plan.preview.receiptPatches[0]
      expect(upsert?.type).toBe('upsertResource')
      if (upsert?.type !== 'upsertResource') continue
      expect(upsert.item).toMatchObject({ type: itemType, ...expectedFields })
    }
  })

  it('plans moves against the command target parent', () => {
    const left = createFolder({ name: 'Left' })
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    const snapshot: SidebarCacheSnapshot = { sidebar: [left, first, second], trash: [] }
    const cache = createTestCache(snapshot)

    const plan = planFileSystemOptimisticCommand({
      command: {
        type: 'move',
        itemIds: [first.id, second.id],
        targetParentId: left.id,
      },
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: null },
      currentUserId: null,
      workspaceId: campaignId,
    })

    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    const applied = applyFileSystemPatchesToSidebarCache(snapshot, plan.preview.receiptPatches)
    const appliedReadModel = createWorkspaceResourceReadModel([
      ...applied.sidebar,
      ...applied.trash,
    ])
    expect(appliedReadModel.getActiveChildren(left.id).map((item) => item.id)).toEqual([
      first.id,
      second.id,
    ])
  })

  it('attributes implicitly trashed replace destinations to the current user', () => {
    const sourceFolder = createFolder({ name: 'Source' })
    const source = createNote({ name: 'Scene', parentId: sourceFolder.id })
    const destination = createNote({ name: 'Scene' })
    const snapshot: SidebarCacheSnapshot = {
      sidebar: [sourceFolder, source, destination],
      trash: [],
    }
    const cache = createTestCache(snapshot)

    const plan = planFileSystemOptimisticCommand({
      command: {
        type: 'move',
        itemIds: [source.id],
        targetParentId: null,
      },
      decisions: [{ sourceItemId: source.id, action: 'replace' }],
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: null },
      currentUserId: userId,
      workspaceId: campaignId,
    })

    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    const applied = applyFileSystemPatchesToSidebarCache(snapshot, plan.preview.receiptPatches)
    expect(applied.trash).toEqual([
      expect.objectContaining({
        id: destination.id,
        status: RESOURCE_STATUS.trashed,
        deletedBy: userId,
      }),
    ])
  })

  it('plans restores against the command target parent', () => {
    const left = createFolder({ name: 'Left' })
    const first = createNote({ name: 'First', status: 'trashed' })
    const second = createNote({ name: 'Second', status: 'trashed' })
    const snapshot: SidebarCacheSnapshot = { sidebar: [left], trash: [first, second] }
    const cache = createTestCache(snapshot)
    const plan = planFileSystemOptimisticCommand({
      command: {
        type: 'restore',
        itemIds: [first.id, second.id],
        targetParentId: left.id,
      },
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: null },
      currentUserId: null,
      workspaceId: campaignId,
    })

    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    const applied = applyFileSystemPatchesToSidebarCache(snapshot, plan.preview.receiptPatches)
    const appliedReadModel = createWorkspaceResourceReadModel([
      ...applied.sidebar,
      ...applied.trash,
    ])
    expect(appliedReadModel.getActiveChildren(left.id).map((item) => item.id)).toEqual([
      first.id,
      second.id,
    ])
  })

  it('treats restore target null as an explicit root target', () => {
    const activeFolder = createFolder({ name: 'Active folder' })
    const trashed = createNote({ name: 'Trashed', status: 'trashed' })
    const snapshot: SidebarCacheSnapshot = { sidebar: [activeFolder], trash: [trashed] }
    const cache = createTestCache(snapshot)

    const plan = planFileSystemOptimisticCommand({
      command: {
        type: 'restore',
        itemIds: [trashed.id],
        targetParentId: null,
      },
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: activeFolder.id },
      currentUserId: null,
      workspaceId: campaignId,
    })

    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    const applied = applyFileSystemPatchesToSidebarCache(snapshot, plan.preview.receiptPatches)
    const appliedReadModel = createWorkspaceResourceReadModel([
      ...applied.sidebar,
      ...applied.trash,
    ])
    expect(appliedReadModel.getActiveChildren(null).map((item) => item.id)).toEqual([
      activeFolder.id,
      trashed.id,
    ])
  })

  it('plans restores at root when the requested target is trashed', () => {
    const activeFolder = createFolder({ name: 'Active folder' })
    const trashedTarget = createFolder({
      name: 'Trashed target',
      status: RESOURCE_STATUS.trashed,
    })
    const trashed = createNote({ name: 'Trashed', status: RESOURCE_STATUS.trashed })
    const snapshot: SidebarCacheSnapshot = {
      sidebar: [activeFolder],
      trash: [trashedTarget, trashed],
    }
    const cache = createTestCache(snapshot)

    const plan = planFileSystemOptimisticCommand({
      command: {
        type: 'restore',
        itemIds: [trashed.id],
        targetParentId: trashedTarget.id,
      },
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: activeFolder.id },
      currentUserId: null,
      workspaceId: campaignId,
    })

    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    const applied = applyFileSystemPatchesToSidebarCache(snapshot, plan.preview.receiptPatches)
    const appliedReadModel = createWorkspaceResourceReadModel([
      ...applied.sidebar,
      ...applied.trash,
    ])
    expect(appliedReadModel.getActiveChildren(null).map((item) => item.id)).toEqual([
      activeFolder.id,
      trashed.id,
    ])
  })

  it('does not model unchanged rename previews as mutations', () => {
    const note = createNote({ name: 'Scene' })
    const snapshot: SidebarCacheSnapshot = { sidebar: [note], trash: [] }
    const cache = createTestCache(snapshot)

    const plan = planFileSystemOptimisticCommand({
      command: {
        type: 'rename',
        itemId: note.id,
        name: note.name,
        iconName: note.iconName,
        color: note.color,
      },
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: null },
      currentUserId: userId,
      workspaceId: campaignId,
    })

    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    expect(plan.preview).toEqual({
      receiptPatches: [],
      inversePatches: [],
      optimisticIntents: [],
      rollbackIntents: [],
    })
  })

  it('returns unavailable when command resources disappeared before planning', () => {
    const snapshot: SidebarCacheSnapshot = { sidebar: [], trash: [] }
    const cache = createTestCache(snapshot)

    const plan = planFileSystemOptimisticCommand({
      command: {
        type: 'trash',
        itemIds: ['removed-item' as never],
      },
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: null },
      currentUserId: userId,
      workspaceId: campaignId,
    })

    expect(plan).toEqual({ status: 'unavailable', reason: 'resources_missing' })
  })
})
