import { getDropTargetKey } from './drop-target-data'

function executorKey(prefix: string, target: Record<string, unknown>) {
  const targetKey = getDropTargetKey(target)
  return targetKey ? `${prefix}:${targetKey}` : null
}

export function createKeyedExecutorRegistry<TExecutor>() {
  const executors = new Map<string, TExecutor>()

  return {
    get(prefix: string, target: Record<string, unknown>) {
      const key = executorKey(prefix, target)
      return key ? (executors.get(key) ?? null) : null
    },
    register({
      execute,
      prefix,
      target,
    }: {
      execute: TExecutor
      prefix: string
      target: Record<string, unknown>
    }) {
      const key = executorKey(prefix, target)
      if (!key) {
        console.warn('Ignoring drag/drop executor registration without a target key', {
          prefix,
          target,
        })
        return () => undefined
      }

      executors.set(key, execute)
      return () => {
        if (executors.get(key) === execute) {
          executors.delete(key)
        }
      }
    },
  }
}
