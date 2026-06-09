import type { DropResult } from '~/features/file-upload/utils/folder-reader'
import { getDropTargetKey } from '~/features/dnd/utils/drop-target-data'

type ExternalFileDropInput = {
  clientX: number
  clientY: number
}

type ExternalFileDropOutcome =
  | { handled: false }
  | {
      handled: true
      unhandledDropResult?: DropResult
    }

type ExternalFileDropExecutor = (
  dropResult: DropResult,
  input: ExternalFileDropInput,
) => Promise<ExternalFileDropOutcome>

const externalFileDropExecutors = new Map<string, ExternalFileDropExecutor>()

function externalFileDropExecutorKey(target: Record<string, unknown>) {
  const targetKey = getDropTargetKey(target)
  return targetKey ? `external-file-drop:${targetKey}` : null
}

export function registerExternalFileDropExecutor({
  target,
  execute,
}: {
  target: Record<string, unknown>
  execute: ExternalFileDropExecutor
}) {
  const key = externalFileDropExecutorKey(target)
  if (!key) return () => undefined

  externalFileDropExecutors.set(key, execute)
  return () => {
    if (externalFileDropExecutors.get(key) === execute) {
      externalFileDropExecutors.delete(key)
    }
  }
}

export async function executeRegisteredExternalFileDropCommand({
  target,
  dropResult,
  input,
}: {
  target: Record<string, unknown>
  dropResult: DropResult
  input: ExternalFileDropInput
}): Promise<ExternalFileDropOutcome> {
  const key = externalFileDropExecutorKey(target)
  const executor = key ? externalFileDropExecutors.get(key) : null
  if (!executor) return { handled: false }

  return await executor(dropResult, input)
}
