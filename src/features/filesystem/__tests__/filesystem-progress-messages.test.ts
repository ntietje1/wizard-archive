import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { assertSidebarItemName } from 'convex/sidebarItems/validation/name'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemCommand } from 'convex/sidebarItems/filesystem/commands'
import {
  getCommandProgressToastText,
  getHistoryProgressToastText,
} from '../filesystem-progress-messages'

const itemId = (value: string) => value as Id<'sidebarItems'>

describe('filesystem progress messages', () => {
  it.each([
    [
      {
        type: 'create',
        itemType: SIDEBAR_ITEM_TYPES.notes,
        name: assertSidebarItemName('Scene'),
        parentTarget: { kind: 'direct', parentId: null },
      },
      'Creating item...',
    ],
    [
      { type: 'rename', itemId: itemId('rename_item'), name: assertSidebarItemName('Renamed') },
      'Renaming item...',
    ],
    [{ type: 'copy', itemIds: [itemId('copy_item')], targetParentId: null }, 'Copying item...'],
    [
      {
        type: 'copy',
        itemIds: [itemId('copy_item_1'), itemId('copy_item_2')],
        targetParentId: null,
      },
      'Copying 2 items...',
    ],
    [{ type: 'move', itemIds: [itemId('move_item')], targetParentId: null }, 'Moving item...'],
    [
      {
        type: 'move',
        itemIds: [itemId('move_item_1'), itemId('move_item_2'), itemId('move_item_3')],
        targetParentId: null,
      },
      'Moving 3 items...',
    ],
    [{ type: 'trash', itemIds: [itemId('trash_item')] }, 'Moving item to trash...'],
    [
      { type: 'trash', itemIds: [itemId('trash_item_1'), itemId('trash_item_2')] },
      'Moving 2 items to trash...',
    ],
    [
      { type: 'restore', itemIds: [itemId('restore_item')], targetParentId: null },
      'Restoring item...',
    ],
    [
      {
        type: 'restore',
        itemIds: [itemId('restore_item_1'), itemId('restore_item_2')],
        targetParentId: null,
      },
      'Restoring 2 items...',
    ],
    [{ type: 'deleteForever', itemIds: [itemId('deleted_item')] }, 'Deleting item forever...'],
    [
      {
        type: 'deleteForever',
        itemIds: [itemId('deleted_item_1'), itemId('deleted_item_2')],
      },
      'Deleting 2 items forever...',
    ],
    [{ type: 'emptyTrash' }, 'Emptying trash...'],
  ] satisfies Array<[FileSystemCommand, string]>)('formats %s as %s', (command, expected) => {
    expect(getCommandProgressToastText(command)).toBe(expected)
  })

  it('formats history operation progress', () => {
    expect(getHistoryProgressToastText('undo')).toBe('Undoing...')
    expect(getHistoryProgressToastText('redo')).toBe('Redoing...')
  })
})
