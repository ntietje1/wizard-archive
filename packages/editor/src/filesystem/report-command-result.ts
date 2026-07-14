import { handleError } from '../errors/handle-error'
import type { ResourceTrashRequestResult } from './operation-runtime-contract'
import type { ResourceCommandResult } from './transaction-contract'

type ReportableResourceCommandResult = ResourceCommandResult | ResourceTrashRequestResult
type ResourceCommandErrorReporter = (error: unknown, fallbackMessage: string) => void

export function reportResourceCommandFailure(
  result: ReportableResourceCommandResult,
  fallbackMessage: string,
  reportError: ResourceCommandErrorReporter = handleError,
) {
  switch (result.status) {
    case 'completed':
    case 'pending':
    case 'noop':
      return false
    case 'error':
      reportError(result.error ?? new Error(fallbackMessage), fallbackMessage)
      return true
    case 'rejected':
      reportError(new Error('Filesystem history changed. Try again.'), fallbackMessage)
      return true
    case 'unsupported':
      reportError(
        new Error(`Operation is not supported: ${formatReason(result.reason)}`),
        fallbackMessage,
      )
      return true
    case 'unavailable':
      reportError(
        new Error(`Operation is unavailable: ${formatReason(result.reason)}`),
        fallbackMessage,
      )
      return true
  }
}

function formatReason(reason: string) {
  return reason.replaceAll('_', ' ')
}
