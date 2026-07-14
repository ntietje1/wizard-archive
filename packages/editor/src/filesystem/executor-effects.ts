import { toast } from 'sonner'

import { handleError } from '../errors/handle-error'
import type { ResourceTransactionReceipt } from './transaction-contract'
import { getReceiptToastMessage } from './receipt-toast-message'
import type { FileSystemReceiptEffectError } from './receipt-effects'

type ProgressToastId = string | number

export type FileSystemExecutorEffects = {
  reportError: (error: unknown, message: string) => void
  reportReceiptEffectError: (error: unknown, context: FileSystemReceiptEffectError) => void
  showProgress: (message: string) => ProgressToastId
  dismissProgress: (toastId: ProgressToastId) => void
  showReceiptToast: (receipt: ResourceTransactionReceipt) => void
}

function reportFileSystemError(error: unknown, message: string) {
  try {
    handleError(error, message)
  } catch (reportError) {
    console.error('Failed to report filesystem error', { message, error, reportError })
  }
}

function reportReceiptEffectError(error: unknown, context: FileSystemReceiptEffectError) {
  console.error('Failed to apply filesystem receipt effect', {
    effect: context.effect,
    transactionId: context.receipt.transactionId,
    direction: context.receipt.direction,
    currentResourceId: context.currentResourceId,
    navigationResourceId: context.navigationResourceId,
    error,
  })
}

function showReceiptToast(receipt: ResourceTransactionReceipt) {
  const message = getReceiptToastMessage(receipt)
  if (!message) return
  toast.success(message.text)
}

export function createFileSystemExecutorEffects(): FileSystemExecutorEffects {
  return {
    reportError: reportFileSystemError,
    reportReceiptEffectError,
    showProgress: toast.loading,
    dismissProgress: toast.dismiss,
    showReceiptToast,
  }
}
