import type { ResourceId } from '../../../resources/domain-id'
import { planTransferOperations } from '../../operation-contract'
import type { OperationPlannerItem } from '../../operation-contract'

type TransferPlanInput = {
  graphItems?: Array<OperationPlannerItem>
  items: Array<OperationPlannerItem>
  targetParentId: ResourceId | null
}

function buildTransferItemsById({ graphItems = [], items }: TransferPlanInput) {
  return new Map<ResourceId, OperationPlannerItem>(
    [...items, ...graphItems].map((item) => [item.id, item]),
  )
}

export function planCopyTransfer(args: TransferPlanInput) {
  return planTransferOperations({
    ...args,
    mode: 'copy',
    itemsById: buildTransferItemsById(args),
  })
}

export function planMoveTransfer(args: TransferPlanInput) {
  return planTransferOperations({
    ...args,
    mode: 'move',
    itemsById: buildTransferItemsById(args),
  })
}
