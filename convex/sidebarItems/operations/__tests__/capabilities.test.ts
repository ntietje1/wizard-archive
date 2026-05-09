import { describe, expect, it } from 'vitest'
import { CAMPAIGN_MEMBER_ROLE } from '../../../campaigns/types'
import { PERMISSION_LEVEL } from '../../../permissions/types'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../types/baseTypes'
import { createSidebarItem } from './testSidebarItem'
import {
  evaluateMoveToParent,
  evaluatePasteTarget,
  evaluatePermanentDelete,
  evaluateTrash,
} from '../capabilities'
describe('sidebar operation capabilities', () => {
  it('rejects player trashing a folder', () => {
    const result = evaluateTrash(
      { role: CAMPAIGN_MEMBER_ROLE.Player },
      createSidebarItem('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders),
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
      createSidebarItem('note-1', 'Note', SIDEBAR_ITEM_TYPES.notes, {
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
    const parent = createSidebarItem('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders, {
      myPermissionLevel: PERMISSION_LEVEL.EDIT,
    })

    const result = evaluateMoveToParent(
      { role: CAMPAIGN_MEMBER_ROLE.DM },
      createSidebarItem('note-1', 'Note'),
      {
        parentId: parent._id,
        parent,
      },
    )

    expect(result).toEqual({
      ok: false,
      code: 'no_target_permission',
      message: 'You do not have sufficient permission for this folder',
    })
  })

  it('rejects moving a folder into its descendant', () => {
    const folder = createSidebarItem('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders)
    const descendant = createSidebarItem('folder-2', 'Child', SIDEBAR_ITEM_TYPES.folders)

    const result = evaluateMoveToParent({ role: CAMPAIGN_MEMBER_ROLE.DM }, folder, {
      parentId: descendant._id,
      parent: descendant,
      ancestorIds: [folder._id],
    })

    expect(result).toEqual({
      ok: false,
      code: 'circular',
      message: 'This move would create a circular reference',
    })
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
      createSidebarItem('note-1', 'Note'),
    )

    expect(result).toEqual({
      ok: false,
      code: 'not_trashed',
      message: 'This item is no longer in the trash',
    })
  })

  it('allows DM to trash items', () => {
    expect(
      evaluateTrash({ role: CAMPAIGN_MEMBER_ROLE.DM }, createSidebarItem('note-2', 'Note')),
    ).toEqual({ ok: true })
  })

  it('allows DM to permanently delete trashed items', () => {
    const trashedNote = createSidebarItem('note-1', 'Note', SIDEBAR_ITEM_TYPES.notes, {
      location: SIDEBAR_ITEM_LOCATION.trash,
    })

    expect(evaluatePermanentDelete({ role: CAMPAIGN_MEMBER_ROLE.DM }, trashedNote)).toEqual({
      ok: true,
    })
  })

  it('allows DM to paste to accessible folders', () => {
    const folder = createSidebarItem('folder-1', 'Folder', SIDEBAR_ITEM_TYPES.folders)

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
      createSidebarItem('note-1', 'Note', SIDEBAR_ITEM_TYPES.notes, {
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
