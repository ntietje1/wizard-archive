import { useRef, useState } from 'react'
import { toast } from 'sonner'
import type { MaybePromise } from '../../../../shared/common/async'
import { getClientErrorMessage } from '../../../../shared/errors/client'
import type { ResourceOperationResult } from './transaction-contract'

type ResourceReplacementValidation = { valid: true } | { valid: false; error: string }

const RESOURCE_REPLACEMENT_TIMEOUT_MS = 30_000

interface ResourceReplacementControllerOptions {
  allowSelectionWhilePending?: boolean
  disabledMessage: string
  enabled: boolean
  failureMessage: string
  inProgressMessage: string
  onAcceptedFile?: (file: File) => ResourceReplacementValidation | void
  onRejectedFile?: (message: string) => void
  onReplacementError?: (message: string) => void
  replace: (file: File) => MaybePromise<ResourceOperationResult>
  successMessage: string
  timeoutMessage?: string
  toastRejectedFiles?: boolean
  validateFile: (file: File) => ResourceReplacementValidation
}

export function useResourceReplacementController({
  allowSelectionWhilePending = false,
  disabledMessage,
  enabled,
  failureMessage,
  inProgressMessage,
  onAcceptedFile,
  onRejectedFile,
  onReplacementError,
  replace,
  successMessage,
  timeoutMessage = failureMessage,
  toastRejectedFiles = true,
  validateFile,
}: ResourceReplacementControllerOptions) {
  const [replacementError, setReplacementError] = useState('')
  const [isReplacing, setIsReplacing] = useState(false)
  const isReplacingRef = useRef(false)
  const activeSelectionsRef = useRef(new Set<symbol>())
  const latestSelectionRef = useRef<symbol | null>(null)

  const rejectReplacement = (message: string) => {
    setReplacementError(message)
    onRejectedFile?.(message)
    if (toastRejectedFiles) {
      toast.error(message)
    }
  }

  const attemptReplacement = (file: File) => {
    if (!enabled) return { valid: false, error: disabledMessage }
    if (isReplacingRef.current && !allowSelectionWhilePending) {
      return { valid: false, error: inProgressMessage }
    }

    const validation = validateFile(file)
    if (!validation.valid) {
      rejectReplacement(validation.error)
      return validation
    }

    const accepted = onAcceptedFile?.(file)
    if (accepted && !accepted.valid) {
      rejectReplacement(accepted.error)
      return accepted
    }

    const selectionId = Symbol(file.name)
    activeSelectionsRef.current.add(selectionId)
    latestSelectionRef.current = selectionId
    setReplacementError('')
    isReplacingRef.current = true
    setIsReplacing(true)

    void runResourceReplacementWithTimeout({
      operation: () => replace(file),
      timeoutMessage,
    })
      .then((result) => {
        if (isCompletedResourceOperation(result)) {
          toast.success(successMessage)
          return
        }
        reportResourceReplacementError(result, failureMessage, (message) => {
          if (latestSelectionRef.current !== selectionId) return
          setReplacementError(message)
          onReplacementError?.(message)
        })
      })
      .catch((error: unknown) => {
        reportResourceReplacementError(error, failureMessage, (message) => {
          if (latestSelectionRef.current !== selectionId) return
          setReplacementError(message)
          onReplacementError?.(message)
        })
      })
      .finally(() => {
        activeSelectionsRef.current.delete(selectionId)
        if (latestSelectionRef.current === selectionId) latestSelectionRef.current = null
        const hasActiveReplacement = allowSelectionWhilePending
          ? latestSelectionRef.current !== null
          : activeSelectionsRef.current.size > 0
        isReplacingRef.current = hasActiveReplacement
        setIsReplacing(hasActiveReplacement)
      })

    return validation
  }

  return { attemptReplacement, isReplacing, rejectReplacement, replacementError }
}

export async function runResourceReplacementWithTimeout({
  operation,
  timeoutMessage,
  timeoutMs = RESOURCE_REPLACEMENT_TIMEOUT_MS,
}: {
  operation: () => MaybePromise<ResourceOperationResult>
  timeoutMessage: string
  timeoutMs?: number
}) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new ResourceReplacementTimeoutError(timeoutMessage)),
      timeoutMs,
    )
  })

  try {
    const operationResult = operation()
    return await Promise.race([operationResult, timeout])
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId)
  }
}

function isCompletedResourceOperation(
  result: ResourceOperationResult,
): result is Extract<ResourceOperationResult, { status: 'completed' }> {
  return result.status === 'completed'
}

export function assertCompletedResourceReplacement(
  result: ResourceOperationResult,
  message = 'Resource replacement did not complete',
) {
  if (!isCompletedResourceOperation(result)) {
    throw new Error(message)
  }
}

function reportResourceReplacementError(
  error: unknown,
  fallbackMessage: string,
  onError: (message: string) => void,
) {
  const message = getClientErrorMessage(resolveResourceOperationError(error)) ?? fallbackMessage
  onError(message)
  toast.error(message)
  console.error(error)
}

function resolveResourceOperationError(error: unknown) {
  if (error instanceof ResourceReplacementTimeoutError) {
    return { data: { kind: 'client', code: 'CONFLICT', message: error.message } }
  }
  if (isResourceOperationFailure(error)) {
    if (error.status === 'error') return error.error
    return { data: { kind: 'client', code: 'CONFLICT', message: error.reason } }
  }
  return error
}

class ResourceReplacementTimeoutError extends Error {}

function isResourceOperationFailure(
  error: unknown,
): error is Exclude<ResourceOperationResult, { status: 'completed' }> {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error.status === 'error' || error.status === 'unsupported' || error.status === 'unavailable')
  )
}
