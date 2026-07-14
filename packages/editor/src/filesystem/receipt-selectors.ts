import type { SidebarItemId } from '../../../../shared/common/ids'
import { RESOURCE_STATUS } from '../workspace/items-persistence-contract'
import type { ResourceEvent, ResourceTransactionReceipt } from './transaction-contract'

type ResourceEventByType<TType extends ResourceEvent['type']> = Extract<
  ResourceEvent,
  { type: TType }
>

function isReceiptEventType<TType extends ResourceEvent['type']>(type: TType) {
  return (event: ResourceEvent): event is ResourceEventByType<TType> => event.type === type
}

function createReceiptEventGroups(receipt: ResourceTransactionReceipt) {
  return {
    created: receipt.events.filter(isReceiptEventType('created')),
    renamed: receipt.events.filter(isReceiptEventType('renamed')),
    copied: receipt.events.filter(isReceiptEventType('copied')),
    moved: receipt.events.filter(isReceiptEventType('moved')),
    trashed: receipt.events.filter(isReceiptEventType('trashed')),
    restored: receipt.events.filter(isReceiptEventType('restored')),
    deletedForever: receipt.events.filter(isReceiptEventType('deletedForever')),
  }
}

export function getReceiptRemovedRootIds(
  receipt: ResourceTransactionReceipt,
): Array<SidebarItemId> {
  return receipt.patches.flatMap((patch) => {
    if (patch.type === 'removeResource') return [patch.itemId]
    if (patch.type !== 'updateResource') return []
    return patch.fields.status === RESOURCE_STATUS.undoHidden ||
      patch.fields.status === RESOURCE_STATUS.trashed
      ? [patch.itemId]
      : []
  })
}

export type ReceiptRemovedItemSnapshot = {
  id: SidebarItemId
  parentId: SidebarItemId | null
}

export function getReceiptRemovedItemSnapshots(
  receipt: ResourceTransactionReceipt,
): Array<ReceiptRemovedItemSnapshot> {
  return receipt.patches.flatMap((patch) => {
    if (patch.type === 'removeResource') {
      return [
        {
          id: patch.snapshot.id,
          parentId: patch.snapshot.parentId,
        },
      ]
    }
    if (patch.type !== 'updateResource') return []
    if (
      patch.fields.status !== RESOURCE_STATUS.undoHidden &&
      patch.fields.status !== RESOURCE_STATUS.trashed
    ) {
      return []
    }
    return [
      {
        id: patch.itemId,
        parentId: 'parentId' in patch.before ? (patch.before.parentId ?? null) : null,
      },
    ]
  })
}

export function getReceiptSelectedRootIds(
  receipt: ResourceTransactionReceipt,
): Array<SidebarItemId> {
  const events = createReceiptEventGroups(receipt)
  const selectedEvents =
    receipt.direction === 'undo'
      ? [...events.moved, ...events.trashed]
      : [...events.created, ...events.copied, ...events.moved, ...events.restored]
  return selectedEvents.map((event) => event.itemId)
}

export function getReceiptNavigationItemId(
  receipt: ResourceTransactionReceipt,
  currentResourceId: SidebarItemId | null,
): SidebarItemId | null {
  if (!currentResourceId) return null
  const events = createReceiptEventGroups(receipt)
  const event = events.renamed.find((candidate) => candidate.itemId === currentResourceId)
  return event?.itemId ?? null
}
