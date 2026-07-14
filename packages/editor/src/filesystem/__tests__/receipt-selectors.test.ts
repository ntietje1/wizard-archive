import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'
import type { ResourceCommand } from '../transaction-contract'
import {
  getReceiptNavigationItemId,
  getReceiptRemovedItemSnapshots,
  getReceiptRemovedRootIds,
  getReceiptSelectedRootIds,
} from '../receipt-selectors'
import { canonicalizeResourceItemTitle } from '../../workspace/items'
import { createFileSystemReceipt } from './receipt-factory'

describe('filesystem receipt selectors', () => {
  it('selects moved roots after forward, undo, and redo receipts', () => {
    const itemId = 'item_1' as ResourceId
    const command = {
      type: 'move',
      itemIds: [itemId],
      targetParentId: null,
    } satisfies ResourceCommand

    expect(
      getReceiptSelectedRootIds(
        createFileSystemReceipt({
          command,
          direction: 'forward',
          events: [{ type: 'moved', itemId }],
        }),
      ),
    ).toEqual([itemId])
    expect(
      getReceiptSelectedRootIds(
        createFileSystemReceipt({
          command,
          direction: 'undo',
          events: [{ type: 'moved', itemId }],
        }),
      ),
    ).toEqual([itemId])
    expect(
      getReceiptSelectedRootIds(
        createFileSystemReceipt({
          command,
          direction: 'redo',
          events: [{ type: 'moved', itemId }],
        }),
      ),
    ).toEqual([itemId])
  })

  it('reports the restored item as removed when undoing restore', () => {
    const itemId = 'item_1' as ResourceId
    const command = {
      type: 'restore',
      itemIds: [itemId],
      targetParentId: null,
    } satisfies ResourceCommand

    expect(
      getReceiptRemovedRootIds(
        createFileSystemReceipt({
          command,
          direction: 'undo',
          events: [{ type: 'restored', itemId }],
          patches: [
            {
              type: 'updateResource',
              itemId,
              before: { status: 'active' },
              fields: { status: 'trashed' },
            },
          ],
        }),
      ),
    ).toEqual([itemId])

    expect(
      getReceiptRemovedItemSnapshots(
        createFileSystemReceipt({
          command,
          direction: 'undo',
          events: [{ type: 'restored', itemId }],
          patches: [
            {
              type: 'updateResource',
              itemId,
              before: { status: 'active' },
              fields: { status: 'trashed' },
            },
          ],
        }),
      ),
    ).toEqual([{ id: itemId, parentId: null }])
  })

  it('selects the created copy from copy receipts', () => {
    const copiedItemId = 'copied_item' as ResourceId
    const sourceItemId = 'source_item' as ResourceId
    const command = {
      type: 'copy',
      itemIds: [sourceItemId],
      targetParentId: null,
    } satisfies ResourceCommand

    expect(
      getReceiptSelectedRootIds(
        createFileSystemReceipt({
          command,
          direction: 'forward',
          events: [{ type: 'copied', itemId: copiedItemId, sourceItemId }],
        }),
      ),
    ).toEqual([copiedItemId])
  })

  it('navigates rename receipts by current item id', () => {
    const itemId = 'item_1' as ResourceId
    const command = {
      type: 'rename',
      itemId,
      name: canonicalizeResourceItemTitle('New Scene'),
    } satisfies ResourceCommand

    expect(
      getReceiptNavigationItemId(
        createFileSystemReceipt({
          command,
          direction: 'undo',
          events: [
            {
              type: 'renamed',
              itemId,
            },
          ],
        }),
        itemId,
      ),
    ).toBe(itemId)
  })
})
