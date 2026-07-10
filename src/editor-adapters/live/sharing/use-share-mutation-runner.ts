import { useState } from 'react'
import type { MaybePromise } from 'shared/common/async'
import { handleError } from '~/shared/utils/logger'

type ShareMutationCommandResult = { status: string; error?: unknown }
type ShareMutationRunnerResult = { status: 'completed' } | { status: 'failed'; error?: unknown }

export async function executeShareCommand(
  command: () => MaybePromise<ShareMutationCommandResult>,
  errorMessage: string,
): Promise<ShareMutationRunnerResult> {
  try {
    const result = await command()
    if (result.status === 'completed') return { status: 'completed' }
    if (result.status === 'error') {
      handleError(result.error, errorMessage)
      return { status: 'failed', error: result.error }
    }
    return { status: 'failed' }
  } catch (error) {
    handleError(error, errorMessage)
    return { status: 'failed', error }
  }
}

export function useShareMutationRunner() {
  const [pendingMutationCount, setPendingMutationCount] = useState(0)
  const isMutating = pendingMutationCount > 0

  const runShareCommand = async (
    command: () => MaybePromise<ShareMutationCommandResult>,
    errorMessage: string,
  ): Promise<ShareMutationRunnerResult> => {
    try {
      setPendingMutationCount((count) => count + 1)
      return await executeShareCommand(command, errorMessage)
    } finally {
      setPendingMutationCount((count) => count - 1)
    }
  }

  return { isMutating, runShareCommand }
}
