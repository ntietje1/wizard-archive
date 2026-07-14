import type { ResourceId } from './domain-id'
import { isTrashedSidebarItem } from './items/status'
import { normalizeSelectedRoots } from './selection-roots'
import type { ResourcePatchRow } from './patch-contract'

export type OperationPlannerItem<TId extends string = ResourceId> = Pick<
  ResourcePatchRow,
  'name' | 'type' | 'status'
> & {
  id: TId
  parentId: TId | null
}

type TransferMode = 'copy' | 'move'

export type TransferOperation<TId extends string = ResourceId> = {
  sourceItemId: TId
  action: 'place'
  targetParentId: TId | null
  name?: string
}

type PlanTransferOperationsInput<TId extends string> = {
  mode: TransferMode
  items: Array<OperationPlannerItem<TId>>
  itemsById: ReadonlyMap<TId, Pick<OperationPlannerItem<TId>, 'id' | 'parentId'>>
  targetParentId: TId | null
}

export function planTransferOperations<TId extends string>({
  mode,
  items,
  itemsById,
  targetParentId,
}: PlanTransferOperationsInput<TId>): Array<TransferOperation<TId>> {
  const roots = normalizeSelectedRoots(items, itemsById)
  const operations = roots.flatMap((item): Array<TransferOperation<TId>> => {
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

  return operations
}
