import { describe, expect, it } from 'vitest'
import { planFileSystemOptimisticCommand } from '../filesystem-optimistic-planner'
import { applyFileSystemPatchesToSnapshot } from '../filesystem-cache-patches'
import { createFileSystemCacheAdapter } from '../filesystem-cache-adapter'
import type { SidebarCacheSnapshot } from '../filesystem-cache-patches'
import type { Id } from 'convex/_generated/dataModel'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'

const campaignId = 'campaign' as Id<'campaigns'>

function createTestCache(snapshot: SidebarCacheSnapshot) {
  const adapter = createFileSystemCacheAdapter({
    get: (view) => (view === 'trash' ? snapshot.trash : snapshot.sidebar),
    update: () => {},
  })
  return {
    snapshot,
    readModel: adapter.getReadModel(),
  }
}

describe('filesystem optimistic planning', () => {
  it('plans moves against the command target parent', () => {
    const left = createFolder({ name: 'Left' })
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    const snapshot: SidebarCacheSnapshot = { sidebar: [left, first, second], trash: [] }
    const cache = createTestCache(snapshot)

    const plan = planFileSystemOptimisticCommand({
      command: {
        type: 'move',
        itemIds: [first._id, second._id],
        targetParentId: left._id,
      },
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: null },
      currentUserId: null,
      campaignId,
      resolveOperationItems: (items) => items,
    })

    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    const applied = applyFileSystemPatchesToSnapshot(snapshot, plan.forwardPatches ?? [])
    const movedFirst = applied.sidebar.find((item) => item._id === first._id)
    const movedSecond = applied.sidebar.find((item) => item._id === second._id)
    expect(movedFirst).toBeDefined()
    expect(movedSecond).toBeDefined()
    expect(movedFirst!.parentId).toBe(left._id)
    expect(movedSecond!.parentId).toBe(left._id)
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
        itemIds: [first._id, second._id],
        targetParentId: left._id,
      },
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: null },
      currentUserId: null,
      campaignId,
      resolveOperationItems: (items) => items,
    })

    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    const applied = applyFileSystemPatchesToSnapshot(snapshot, plan.forwardPatches ?? [])
    const restoredFirst = applied.sidebar.find((item) => item._id === first._id)
    const restoredSecond = applied.sidebar.find((item) => item._id === second._id)
    expect(restoredFirst).toBeDefined()
    expect(restoredSecond).toBeDefined()
    expect(restoredFirst!.parentId).toBe(left._id)
    expect(restoredSecond!.parentId).toBe(left._id)
    expect(applied.trash).toEqual([])
  })

  it('treats restore target null as explicit root instead of active surface fallback', () => {
    const activeFolder = createFolder({ name: 'Active folder' })
    const trashed = createNote({ name: 'Trashed', status: 'trashed' })
    const snapshot: SidebarCacheSnapshot = { sidebar: [activeFolder], trash: [trashed] }
    const cache = createTestCache(snapshot)

    const plan = planFileSystemOptimisticCommand({
      command: {
        type: 'restore',
        itemIds: [trashed._id],
        targetParentId: null,
      },
      snapshot: cache.snapshot,
      readModel: cache.readModel,
      activeItemSurface: { parentId: activeFolder._id },
      currentUserId: null,
      campaignId,
      resolveOperationItems: (items) => items,
    })

    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    const applied = applyFileSystemPatchesToSnapshot(snapshot, plan.forwardPatches ?? [])
    expect(applied.sidebar.find((item) => item._id === trashed._id)?.parentId).toBeNull()
  })
})
