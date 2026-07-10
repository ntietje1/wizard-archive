import { summarizeResourceReceipt } from '../transaction-contract'
import type {
  ResourceCommand,
  ResourceEvent,
  ResourceTransactionReceipt,
} from '../transaction-contract'
import type { AnyItem } from '../../workspace/items'
import type { FileSystemTransactionId } from '../../../../../shared/common/ids'
import { sidebarCachePatchItemFromCacheItem } from '../cache-patches'

export function createFileSystemReceipt({
  command,
  direction = 'forward',
  events,
  patches = [],
  transactionId = 'transaction_1' as FileSystemTransactionId,
  undoable = true,
}: {
  command: ResourceCommand
  direction?: ResourceTransactionReceipt['direction']
  events: Array<ResourceEvent>
  patches?: ResourceTransactionReceipt['patches']
  transactionId?: FileSystemTransactionId
  undoable?: boolean
}): ResourceTransactionReceipt {
  return {
    transactionId,
    direction,
    command,
    events,
    patches,
    summary: summarizeResourceReceipt(command, events),
    undoable,
  }
}

export function createCreatedItemReceipt(item: AnyItem): ResourceTransactionReceipt {
  const command = {
    type: 'create',
    itemType: item.type,
    name: item.name,
    parentTarget: { kind: 'direct', parentId: item.parentId },
  } satisfies ResourceCommand
  const events = [
    { type: 'created', itemId: item.id, slug: item.slug },
  ] satisfies Array<ResourceEvent>

  return createFileSystemReceipt({
    command,
    events,
    patches: [{ type: 'upsertResource', item: sidebarCachePatchItemFromCacheItem(item) }],
  })
}
