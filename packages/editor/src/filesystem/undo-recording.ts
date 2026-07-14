import type { ResourceTransactionReceipt } from './transaction-contract'
import type { OperationId } from '../resources/domain-id'

export function shouldRecordFileSystemUndo(
  receipt: Pick<ResourceTransactionReceipt, 'transactionId' | 'undoable'>,
): receipt is Pick<ResourceTransactionReceipt, 'transactionId' | 'undoable'> & {
  transactionId: OperationId
} {
  return receipt.undoable && receipt.transactionId !== null
}
