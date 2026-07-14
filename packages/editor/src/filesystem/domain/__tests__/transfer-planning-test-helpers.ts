import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { planTransferOperations } from '../../operation-contract'
import type { OperationPlannerItem } from '../../operation-contract'

type TransferPlanInput = Omit<
  Parameters<typeof planTransferOperations>[0],
  'itemsById' | 'mode'
> & {
  graphItems?: Array<OperationPlannerItem>
}

function buildTransferItemsById({ graphItems = [], items }: TransferPlanInput) {
  return new Map<SidebarItemId, OperationPlannerItem>(
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
