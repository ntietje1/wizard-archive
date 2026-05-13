import { describe, expect, it } from 'vitest'
import { CAMPAIGN_MEMBER_ROLE } from '../../../campaigns/types'
import { PERMISSION_LEVEL } from '../../../permissions/types'
import { SIDEBAR_ITEM_STATUS, SIDEBAR_ITEM_TYPES } from '../../types/baseTypes'
import { commonParentId, planFileSystemDropIntent, resolvePasteParentId } from '../intentPlanning'
import { createSidebarItem } from './testSidebarItem'
import type { Id } from '../../../_generated/dataModel'

describe('filesystem intent planning', () => {
  it('resolves paste targets from explicit parent and selected common parent', () => {
    const parentId = 'folder-1' as Id<'sidebarItems'>
    const fallbackParentId = 'folder-2' as Id<'sidebarItems'>
    const first = createSidebarItem('note-1', 'One', SIDEBAR_ITEM_TYPES.notes, { parentId })
    const second = createSidebarItem('note-2', 'Two', SIDEBAR_ITEM_TYPES.notes, { parentId })

    expect(commonParentId([first, second])).toBe(parentId)
    expect(
      resolvePasteParentId({
        items: [first, second],
        target: { kind: 'explicit', parentId: null },
      }),
    ).toBeNull()
    expect(
      resolvePasteParentId({
        items: [first, second],
        target: { kind: 'selectedCommonParent', surfaceParentId: fallbackParentId },
      }),
    ).toBe(parentId)
  })

  it('falls back to the surface parent when selected items have no common parent', () => {
    const surfaceParentId = 'folder-1' as Id<'sidebarItems'>
    const first = createSidebarItem('note-1', 'One')
    const second = createSidebarItem('note-2', 'Two', SIDEBAR_ITEM_TYPES.notes, {
      parentId: 'folder-2' as Id<'sidebarItems'>,
    })

    expect(
      resolvePasteParentId({
        items: [first, second],
        target: { kind: 'selectedCommonParent', surfaceParentId },
      }),
    ).toBe(surfaceParentId)
  })

  it('plans trash drops and ignores already trashed items', () => {
    const actor = { role: CAMPAIGN_MEMBER_ROLE.DM }
    const active = createSidebarItem('note-1', 'Active')
    const trashed = createSidebarItem('note-2', 'Trashed', SIDEBAR_ITEM_TYPES.notes, {
      status: SIDEBAR_ITEM_STATUS.trashed,
      isActive: false,
      isTrashed: true,
    })

    expect(
      planFileSystemDropIntent({
        actor,
        items: [active, trashed],
        target: { type: 'trash' },
      }),
    ).toEqual({ status: 'ready', command: { type: 'trash', itemIds: [active._id] } })
  })

  it('plans copy, move, and restore drops to parent targets', () => {
    const actor = { role: CAMPAIGN_MEMBER_ROLE.DM }
    const target = createSidebarItem('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders)
    const source = createSidebarItem('note-1', 'Source')
    const trashed = createSidebarItem('note-2', 'Trashed', SIDEBAR_ITEM_TYPES.notes, {
      status: SIDEBAR_ITEM_STATUS.trashed,
      isActive: false,
      isTrashed: true,
    })
    const parentTarget = { parentId: target._id, parent: target, ancestorIds: [target._id] }

    expect(
      planFileSystemDropIntent({
        actor,
        items: [source],
        target: { type: 'parent', target: parentTarget },
      }),
    ).toEqual({
      status: 'ready',
      command: { type: 'move', itemIds: [source._id], targetParentId: target._id },
    })
    expect(
      planFileSystemDropIntent({
        actor,
        items: [source],
        target: { type: 'parent', target: parentTarget },
        options: { copy: true },
      }),
    ).toEqual({
      status: 'ready',
      command: { type: 'copy', itemIds: [source._id], targetParentId: target._id },
    })
    expect(
      planFileSystemDropIntent({
        actor,
        items: [trashed],
        target: { type: 'parent', target: parentTarget },
      }),
    ).toEqual({
      status: 'ready',
      command: { type: 'restore', itemIds: [trashed._id], targetParentId: target._id },
    })
  })

  it('blocks mixed move and restore drops', () => {
    const actor = { role: CAMPAIGN_MEMBER_ROLE.DM }
    const target = createSidebarItem('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders)
    const active = createSidebarItem('note-1', 'Active')
    const trashed = createSidebarItem('note-2', 'Trashed', SIDEBAR_ITEM_TYPES.notes, {
      status: SIDEBAR_ITEM_STATUS.trashed,
      isActive: false,
      isTrashed: true,
    })

    expect(
      planFileSystemDropIntent({
        actor,
        items: [active, trashed],
        target: {
          type: 'parent',
          target: { parentId: target._id, parent: target, ancestorIds: [target._id] },
        },
      }),
    ).toEqual({ status: 'blocked', reason: 'mixed_actions' })
  })

  it('blocks copy drops when source permissions are insufficient', () => {
    const actor = { role: CAMPAIGN_MEMBER_ROLE.DM }
    const target = createSidebarItem('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders)
    const source = createSidebarItem('note-1', 'Source', SIDEBAR_ITEM_TYPES.notes, {
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })

    expect(
      planFileSystemDropIntent({
        actor,
        items: [source],
        target: {
          type: 'parent',
          target: { parentId: target._id, parent: target, ancestorIds: [target._id] },
        },
        options: { copy: true },
      }),
    ).toEqual({ status: 'blocked', reason: 'no_source_permission' })
  })
})
