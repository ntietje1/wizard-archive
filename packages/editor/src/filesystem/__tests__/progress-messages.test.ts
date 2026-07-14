import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'
import { canonicalizeResourceItemTitle } from '../../workspace/items'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { ResourceCommand } from '../transaction-contract'
import { getCommandProgressToastText, getHistoryProgressToastText } from '../progress-messages'

import { commandFixtureItemIds, fileSystemCommandFixtures } from './command-fixtures'
import { RESOURCE_COMMAND_TYPE } from '../transaction-contract'

const itemId = (value: string) => value as ResourceId

describe('filesystem progress messages', () => {
  it('has progress coverage for every filesystem command type', () => {
    expect(Object.keys(fileSystemCommandFixtures).sort()).toEqual(
      Object.values(RESOURCE_COMMAND_TYPE).sort(),
    )

    for (const commandType of Object.values(RESOURCE_COMMAND_TYPE)) {
      expect(getCommandProgressToastText(fileSystemCommandFixtures[commandType])).not.toBe('')
    }
  })

  it.each([
    [
      {
        type: 'create',
        resourceId: commandFixtureItemIds.created,
        itemType: RESOURCE_TYPES.notes,
        name: canonicalizeResourceItemTitle('Scene'),
        parentTarget: { kind: 'direct', parentId: null },
      },
      'Creating item...',
    ],
    [
      {
        type: 'rename',
        itemId: itemId('rename_item'),
        name: canonicalizeResourceItemTitle('Renamed'),
      },
      'Renaming item...',
    ],
    [{ type: 'rename', itemId: itemId('metadata_item'), color: null }, 'Updating item...'],
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
    [
      {
        type: 'setResourceAudiencePermission',
        itemIds: [itemId('shared_item')],
        permissionLevel: 'view',
      },
      'Updating sharing...',
    ],
    [{ type: 'toggleBookmarks', itemIds: [itemId('bookmarked_item')] }, 'Updating bookmarks...'],
  ] satisfies Array<[ResourceCommand, string]>)('formats %s as %s', (command, expected) => {
    expect(getCommandProgressToastText(command)).toBe(expected)
  })

  it('formats history operation progress', () => {
    expect(getHistoryProgressToastText('undo')).toBe('Undoing...')
    expect(getHistoryProgressToastText('redo')).toBe('Redoing...')
  })
})
