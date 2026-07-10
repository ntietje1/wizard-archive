import type { SidebarItemId } from '../../../../shared/common/ids'
import { assertResourceItemSlug } from '../workspace/items'
import { RESOURCE_STATUS } from '../workspace/items-persistence-contract'
import type { ResourceSlug } from '../workspace/resource-contract'
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
    mergedFolder: receipt.events.filter(isReceiptEventType('mergedFolder')),
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
  slug: ResourceSlug
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
          slug: assertResourceItemSlug(patch.snapshot.slug),
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
    if (typeof patch.before.slug !== 'string' || !('parentId' in patch.before)) return []
    return [
      {
        id: patch.itemId,
        parentId: patch.before.parentId ?? null,
        slug: assertResourceItemSlug(patch.before.slug),
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
      : [
          ...events.created,
          ...events.copied,
          ...events.moved,
          ...events.restored,
          ...events.mergedFolder,
        ]
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
