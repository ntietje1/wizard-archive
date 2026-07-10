import { toast } from 'sonner'

import { handleError } from '../errors/handle-error'
import type { ResourceTransactionReceipt } from './transaction-contract'
import { getReceiptToastMessage } from './receipt-toast-message'
import type { FileSystemReceiptEffectError } from './receipt-effects'

type ProgressToastId = string | number

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}

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
  switch (message.type) {
    case 'success':
      toast.success(message.text)
      return
    case 'info':
      toast.info(message.text)
      return
    default:
      return assertNever(message)
  }
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
