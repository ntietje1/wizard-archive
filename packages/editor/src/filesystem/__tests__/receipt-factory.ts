import { summarizeResourceReceipt } from '../transaction-contract'
import type {
  ResourceCommand,
  ResourceEvent,
  ResourceTransactionReceipt,
} from '../transaction-contract'
import type { AnyItem } from '../../workspace/items'
import type { OperationId } from '../../resources/domain-id'
import { testOperationId } from '../../test/operation-id'
import { sidebarCachePatchItemFromCacheItem } from '../cache-patches'

export function createFileSystemReceipt({
  command,
  direction = 'forward',
  events,
  patches = [],
  transactionId = testOperationId('transaction_1'),
  undoable = true,
}: {
  command: ResourceCommand
  direction?: ResourceTransactionReceipt['direction']
  events: Array<ResourceEvent>
  patches?: ResourceTransactionReceipt['patches']
  transactionId?: OperationId
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
    resourceId: item.id,
    itemType: item.type,
    name: item.name,
    parentTarget: { kind: 'direct', parentId: item.parentId },
  } satisfies ResourceCommand
  const events = [{ type: 'created', itemId: item.id }] satisfies Array<ResourceEvent>

  return createFileSystemReceipt({
    command,
    events,
    patches: [{ type: 'upsertResource', item: sidebarCachePatchItemFromCacheItem(item) }],
  })
}
