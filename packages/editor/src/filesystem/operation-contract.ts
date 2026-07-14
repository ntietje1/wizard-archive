import type { ResourceId } from '../workspace/resource-contract'
import { isTrashedSidebarItem } from '../workspace/items/status'
import { normalizeSelectedRoots } from './domain/selection-roots'
import type { ResourcePatchRow } from './patch-contract'
import type { ResourceOperationDecision } from './transaction-contract'

export type OperationPlannerItem = Pick<
  ResourcePatchRow,
  'id' | 'parentId' | 'name' | 'type' | 'status'
>

type TransferMode = 'copy' | 'move'

export type TransferOperation = {
  sourceItemId: ResourceId
  action: 'place'
  targetParentId: ResourceId | null
  name?: string
}

type PlanTransferOperationsInput = {
  mode: TransferMode
  items: Array<OperationPlannerItem>
  itemsById: ReadonlyMap<ResourceId, Pick<OperationPlannerItem, 'id' | 'parentId'>>
  targetParentId: ResourceId | null
  targetItems: Array<OperationPlannerItem>
  decisions?: ReadonlyArray<ResourceOperationDecision>
  getChildren?: (parentId: ResourceId) => Array<OperationPlannerItem>
}

type TransferOperationPlan = {
  status: 'ready'
  conflicts: []
  operations: Array<TransferOperation>
}

export function planTransferOperations({
  mode,
  items,
  itemsById,
  targetParentId,
}: PlanTransferOperationsInput): TransferOperationPlan {
  const roots = normalizeSelectedRoots(items, itemsById)
  const operations = roots.flatMap((item): Array<TransferOperation> => {
    if (mode === 'move' && item.parentId === targetParentId && !isTrashedSidebarItem(item)) {
      return []
    }

    return [
      {
        sourceItemId: item.id,
        action: 'place',
        targetParentId,
        ...(mode === 'copy' ? { name: item.name } : {}),
      },
    ]
  })

  return { status: 'ready', conflicts: [], operations }
}
