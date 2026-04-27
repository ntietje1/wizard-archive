import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react'

export interface CanvasNodeResizeMetadata {
  dragging: boolean
  lockedAspectRatio?: number
  minHeight: number
  minWidth: number
}

type CanvasNodeResizeMetadataSnapshot = ReadonlyMap<string, CanvasNodeResizeMetadata>

export interface CanvasNodeResizeMetadataStore {
  getSnapshot: () => CanvasNodeResizeMetadataSnapshot
  register: (nodeId: string, metadata: CanvasNodeResizeMetadata) => () => void
  subscribe: (listener: () => void) => () => void
}

const EMPTY_METADATA = new Map<string, CanvasNodeResizeMetadata>()
export const CanvasNodeResizeMetadataContext = createContext<CanvasNodeResizeMetadataStore | null>(
  null,
)

CanvasNodeResizeMetadataContext.displayName = 'CanvasNodeResizeMetadataContext'

export function useRegisterCanvasNodeResizeMetadata(
  nodeId: string,
  metadata: CanvasNodeResizeMetadata,
) {
  const store = useContext(CanvasNodeResizeMetadataContext)
  const { dragging, lockedAspectRatio, minHeight, minWidth } = metadata

  useEffect(() => {
    if (!store) {
      return undefined
    }

    return store.register(nodeId, {
      dragging,
      lockedAspectRatio,
      minHeight,
      minWidth,
    })
  }, [dragging, lockedAspectRatio, minHeight, minWidth, nodeId, store])
}

export function useCanvasNodeResizeMetadataSnapshot(): CanvasNodeResizeMetadataSnapshot {
  const store = useContext(CanvasNodeResizeMetadataContext)
  const subscribe = useCallback(
    (listener: () => void) => store?.subscribe(listener) ?? (() => undefined),
    [store],
  )
  const getSnapshot = useCallback(() => store?.getSnapshot() ?? EMPTY_METADATA, [store])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function createCanvasNodeResizeMetadataStore(): CanvasNodeResizeMetadataStore {
  let snapshot = EMPTY_METADATA
  const listeners = new Set<() => void>()

  const notify = () => {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    getSnapshot: () => snapshot,
    register: (nodeId, metadata) => {
      const next = new Map(snapshot)
      next.set(nodeId, metadata)
      snapshot = next
      notify()

      return () => {
        if (snapshot.get(nodeId) !== metadata) {
          return
        }
        const nextSnapshot = new Map(snapshot)
        nextSnapshot.delete(nodeId)
        snapshot = nextSnapshot.size > 0 ? nextSnapshot : EMPTY_METADATA
        notify()
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
