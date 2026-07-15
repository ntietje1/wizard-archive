import { useState, useSyncExternalStore } from 'react'

type CommittedRuntime<T> = Readonly<{
  runtime: T
  start(): void
  dispose(): void
}>

function createCommittedRuntimeStore<T>(factory: () => CommittedRuntime<T>) {
  let current: CommittedRuntime<T> | null = null
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => current?.runtime ?? null,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      if (listeners.size === 1) {
        const next = factory()
        current = next
        try {
          next.start()
        } catch (error) {
          current = null
          next.dispose()
          listeners.delete(listener)
          throw error
        }
        listener()
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0 || current === null) return
        const previous = current
        current = null
        previous.dispose()
      }
    },
  }
}

export function useCommittedRuntime<T>(factory: () => CommittedRuntime<T>): T | null {
  const [store] = useState(() => createCommittedRuntimeStore(factory))
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
