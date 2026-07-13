import { toast } from 'sonner'
import { getClientErrorMessage } from '../../../../../shared/errors/client'
import type { ResourceOperationResult } from '../../filesystem/transaction-contract'

export function isCompletedResourceOperation(
  result: ResourceOperationResult,
): result is Extract<ResourceOperationResult, { status: 'completed' }> {
  return result.status === 'completed'
}

export function reportMapActionError(error: unknown, fallbackMessage: string) {
  const resolvedError = resolveMapActionError(error)
  toast.error(getClientErrorMessage(resolvedError) || fallbackMessage)
  console.error(resolvedError)
}

function resolveMapActionError(error: unknown) {
  if (isMapOperationFailure(error)) {
    if (error.status !== 'error') return new Error(error.reason)
    return error.error ?? new Error('Map operation failed without error details')
  }
  return error
}

function isMapOperationFailure(
  error: unknown,
): error is Exclude<ResourceOperationResult, { status: 'completed' }> {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error.status === 'error' || error.status === 'unsupported' || error.status === 'unavailable')
  )
}
