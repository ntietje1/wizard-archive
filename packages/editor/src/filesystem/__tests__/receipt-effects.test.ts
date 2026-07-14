import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_STATUS } from '../../workspace/items-persistence-contract'
import { createNote } from '../../test/sidebar-item-factory'
import { createFileSystemCacheAdapter } from '../cache'
import { resourcePatchRowFromCacheItem } from '../cache-patches'
import type { SidebarCacheSnapshot } from '../cache-patches'
import { planFileSystemReceiptEffects } from '../receipt-effect-planner'
import { createCreatedItemReceipt, createFileSystemReceipt } from './receipt-factory'
import { RESOURCE_COMMAND_TYPE, RESOURCE_EVENT_TYPE } from '../transaction-contract'
import type { ResourceCommand } from '../transaction-contract'

function createReadModel(snapshot: SidebarCacheSnapshot) {
  return createFileSystemCacheAdapter({
    getSnapshot: () => snapshot,
    replaceSnapshot: () => {},
  }).getReadModel()
}

describe('filesystem receipt effects', () => {
  it('plans committed create selection for the created item', () => {
    const item = createNote({
      id: 'item_1' as ResourceId,
      name: 'Scene',
      status: RESOURCE_STATUS.active,
    })
    const receipt = createCreatedItemReceipt(item)
    const snapshot: SidebarCacheSnapshot = {
      sidebar: [item],
      trash: [],
    }

    expect(
      planFileSystemReceiptEffects({
        receipt,
        readModel: createReadModel(snapshot),
        currentResourceId: null,
        selectedItemIds: [],
      }),
    ).toEqual([{ type: 'selectItems', itemIds: ['item_1' as ResourceId] }])
  })

  it('keeps receipt-selected roots as the single final selection when removing old selections', () => {
    const copiedItem = createNote({
      id: 'copied_item' as ResourceId,
      name: 'Scene Copy',
      status: RESOURCE_STATUS.active,
    })
    const replacedItem = createNote({
      id: 'replaced_item' as ResourceId,
      name: 'Scene',
      status: RESOURCE_STATUS.active,
    })
    const sourceItemId = 'source_item' as ResourceId
    const command = {
      type: 'copy',
      itemIds: [sourceItemId],
      targetParentId: null,
    } satisfies ResourceCommand

    expect(
      planFileSystemReceiptEffects({
        receipt: createFileSystemReceipt({
          command,
          events: [{ type: 'copied', itemId: copiedItem.id, sourceItemId }],
          patches: [
            { type: 'upsertResource', item: resourcePatchRowFromCacheItem(copiedItem) },
            {
              type: 'removeResource',
              itemId: replacedItem.id,
              snapshot: resourcePatchRowFromCacheItem(replacedItem),
            },
          ],
        }),
        readModel: createReadModel({ sidebar: [copiedItem], trash: [] }),
        currentResourceId: null,
        selectedItemIds: [replacedItem.id],
      }),
    ).toEqual([{ type: 'selectItems', itemIds: [copiedItem.id] }])
  })

  it('plans rename navigation from the current resource id', () => {
    const item = createNote({
      id: 'renamed_item' as ResourceId,
      name: 'Renamed Scene',
      status: RESOURCE_STATUS.active,
    })
    const renameReceipt = createFileSystemReceipt({
      command: {
        type: RESOURCE_COMMAND_TYPE.rename,
        itemId: item.id,
        color: null,
      },
      events: [
        {
          type: RESOURCE_EVENT_TYPE.renamed,
          itemId: item.id,
        },
      ],
    })
    const readModel = createReadModel({ sidebar: [item], trash: [] })

    expect(
      planFileSystemReceiptEffects({
        receipt: renameReceipt,
        readModel,
        currentResourceId: item.id,
        selectedItemIds: [],
      }),
    ).toEqual([{ type: 'openResource', itemId: item.id, replace: true }])

    expect(
      planFileSystemReceiptEffects({
        receipt: renameReceipt,
        readModel,
        currentResourceId: 'other_item' as ResourceId,
        selectedItemIds: [],
      }),
    ).toEqual([])
  })

  it('clears the editor when the current resource is removed by a receipt snapshot', () => {
    const item = createNote({
      id: 'removed_item' as ResourceId,
      name: 'Removed Scene',
      status: RESOURCE_STATUS.active,
    })

    expect(
      planFileSystemReceiptEffects({
        receipt: createFileSystemReceipt({
          command: {
            type: RESOURCE_COMMAND_TYPE.deleteForever,
            itemIds: [item.id],
          },
          events: [{ type: RESOURCE_EVENT_TYPE.deletedForever, itemId: item.id }],
          patches: [
            {
              type: 'removeResource',
              itemId: item.id,
              snapshot: resourcePatchRowFromCacheItem(item),
            },
          ],
        }),
        readModel: createReadModel({ sidebar: [], trash: [] }),
        currentResourceId: item.id,
        selectedItemIds: [],
      }),
    ).toEqual([{ type: 'clearEditor' }])
  })
})
