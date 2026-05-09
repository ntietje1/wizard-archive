import { describe, expect, it } from 'vitest'
import { CAMPAIGN_MEMBER_ROLE } from '../../../campaigns/types'
import { PERMISSION_LEVEL } from '../../../permissions/types'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../types/baseTypes'
import {
  evaluateMoveToParent,
  evaluatePasteTarget,
  evaluatePermanentDelete,
  evaluateTrash,
} from '../capabilities'
import type { Id } from '../../../_generated/dataModel'
import type { AnySidebarItem } from '../../types/types'

function item(
  id: string,
  name: string,
  type: AnySidebarItem['type'] = SIDEBAR_ITEM_TYPES.notes,
  overrides: Partial<AnySidebarItem> = {},
): AnySidebarItem {
  return {
    _id: id as Id<'sidebarItems'>,
    _creationTime: 1,
    name: name as AnySidebarItem['name'],
    slug: name.toLowerCase() as AnySidebarItem['slug'],
    campaignId: 'campaign' as Id<'campaigns'>,
    iconName: null,
    color: null,
    type,
    parentId: null,
    allPermissionLevel: null,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: 'user' as Id<'userProfiles'>,
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
    ...overrides,
  } as AnySidebarItem
}

describe('sidebar operation capabilities', () => {
  it('rejects player trashing a folder', () => {
    const result = evaluateTrash(
      { role: CAMPAIGN_MEMBER_ROLE.Player },
      item('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders),
    )

    expect(result).toEqual({
      ok: false,
      code: 'dm_only',
      message: 'Only the DM can trash folders',
    })
  })

  it('rejects moving an item without full source access', () => {
    const result = evaluateMoveToParent(
      { role: CAMPAIGN_MEMBER_ROLE.DM },
      item('note-1', 'Note', SIDEBAR_ITEM_TYPES.notes, {
        myPermissionLevel: PERMISSION_LEVEL.EDIT,
      }),
      { parentId: null, parent: null },
    )

    expect(result).toEqual({
      ok: false,
      code: 'no_source_permission',
      message: 'You do not have sufficient permission for this item',
    })
  })

  it('rejects moving into a folder without full target access', () => {
    const parent = item('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders, {
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
    })

    const result = evaluateMoveToParent({ role: CAMPAIGN_MEMBER_ROLE.DM }, item('note-1', 'Note'), {
      parentId: parent._id,
      parent,
    })

    expect(result).toEqual({
      ok: false,
      code: 'no_target_permission',
      message: 'You do not have sufficient permission for this folder',
    })
  })

  it('rejects moving a folder into its descendant', () => {
    const folder = item('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders)
    const descendant = item('folder-2', 'Child', SIDEBAR_ITEM_TYPES.folders)

    const result = evaluateMoveToParent({ role: CAMPAIGN_MEMBER_ROLE.DM }, folder, {
      parentId: descendant._id,
      parent: descendant,
      ancestorIds: [folder._id],
    })

    expect(result).toMatchObject({ ok: false, code: 'circular' })
  })

  it('rejects root paste for non-DM actors', () => {
    const result = evaluatePasteTarget(
      { role: CAMPAIGN_MEMBER_ROLE.Player },
      { parentId: null, parent: null },
    )

    expect(result).toMatchObject({ ok: false, code: 'dm_only' })
  })

  it('rejects permanently deleting an active item', () => {
    const result = evaluatePermanentDelete(
      { role: CAMPAIGN_MEMBER_ROLE.DM },
      item('note-1', 'Note'),
    )

    expect(result).toEqual({
      ok: false,
      code: 'not_trashed',
      message: 'This item is no longer in the trash',
    })
  })

  it('allows DM to trash items', () => {
    expect(evaluateTrash({ role: CAMPAIGN_MEMBER_ROLE.DM }, item('note-2', 'Note'))).toEqual({
      ok: true,
    })
  })

  it('allows DM to permanently delete trashed items', () => {
    const trashedNote = item('note-1', 'Note', SIDEBAR_ITEM_TYPES.notes, {
      location: SIDEBAR_ITEM_LOCATION.trash,
    })

    expect(evaluatePermanentDelete({ role: CAMPAIGN_MEMBER_ROLE.DM }, trashedNote)).toEqual({
      ok: true,
    })
  })

  it('allows DM to paste to accessible folders', () => {
    const folder = item('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders)

    expect(
      evaluatePasteTarget(
        { role: CAMPAIGN_MEMBER_ROLE.DM },
        { parentId: folder._id, parent: folder },
      ),
    ).toEqual({ ok: true })
  })

  it('rejects trashing an item that is already trashed', () => {
    const result = evaluateTrash(
      { role: CAMPAIGN_MEMBER_ROLE.DM },
      item('note-1', 'Note', SIDEBAR_ITEM_TYPES.notes, {
        location: SIDEBAR_ITEM_LOCATION.trash,
      }),
    )

    expect(result).toEqual({
      ok: false,
      code: 'already_trashed',
      message: 'This item is already in the trash',
    })
  })
})
