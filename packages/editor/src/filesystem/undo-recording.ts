import type { ResourceTransactionReceipt } from './transaction-contract'
import type { FileSystemTransactionId } from '../../../../shared/common/ids'

export function shouldRecordFileSystemUndo(
  receipt: Pick<ResourceTransactionReceipt, 'transactionId' | 'undoable'>,
): receipt is Pick<ResourceTransactionReceipt, 'transactionId' | 'undoable'> & {
  transactionId: FileSystemTransactionId
} {
  return receipt.undoable && receipt.transactionId !== null
}
