import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react'

export type CanvasNodeResizeAxes = 'both' | 'horizontal' | 'vertical'

export interface CanvasNodeResizeMetadata {
  dragging: boolean
  lockedAspectRatio?: number
  minHeight: number
  minWidth: number
  resizeAxes: CanvasNodeResizeAxes
}

type CanvasNodeResizeMetadataSnapshot = ReadonlyMap<string, CanvasNodeResizeMetadata>
type CanvasNodeResizeMetadataRegistration = {
  metadata: CanvasNodeResizeMetadata
  token: symbol
}

export interface CanvasNodeResizeMetadataStore {
  getSnapshot: () => CanvasNodeResizeMetadataSnapshot
  register: (nodeId: string, metadata: CanvasNodeResizeMetadata) => () => void
  subscribe: (listener: () => void) => () => void
}

const EMPTY_METADATA: CanvasNodeResizeMetadataSnapshot = new Map()
export const CanvasNodeResizeMetadataContext = createContext<CanvasNodeResizeMetadataStore | null>(
  null,
)

CanvasNodeResizeMetadataContext.displayName = 'CanvasNodeResizeMetadataContext'

export function useRegisterCanvasNodeResizeMetadata(
  nodeId: string,
  metadata: CanvasNodeResizeMetadata,
) {
  const store = useCanvasNodeResizeMetadataStore()
  const { dragging, lockedAspectRatio, minHeight, minWidth, resizeAxes } = metadata

  useEffect(() => {
    return store.register(nodeId, {
      dragging,
      lockedAspectRatio,
      minHeight,
      minWidth,
      resizeAxes,
    })
  }, [dragging, lockedAspectRatio, minHeight, minWidth, nodeId, resizeAxes, store])
}

export function useCanvasNodeResizeMetadataSnapshot(): CanvasNodeResizeMetadataSnapshot {
  const store = useCanvasNodeResizeMetadataStore()
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getSnapshot = useCallback(() => store.getSnapshot(), [store])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function useCanvasNodeResizeMetadataStore(): CanvasNodeResizeMetadataStore {
  const store = useContext(CanvasNodeResizeMetadataContext)
  if (!store) {
    throw new Error('Canvas node resize metadata provider is missing')
  }
  return store
}

export function createCanvasNodeResizeMetadataStore(): CanvasNodeResizeMetadataStore {
  let snapshot: CanvasNodeResizeMetadataSnapshot = EMPTY_METADATA
  let registrations = new Map<string, CanvasNodeResizeMetadataRegistration>()
  const listeners = new Set<() => void>()

  const notify = () => {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    getSnapshot: () => snapshot,
    register: (nodeId, metadata) => {
      const token = Symbol(nodeId)
      registrations.set(nodeId, { metadata, token })
      snapshot = getSnapshotFromRegistrations(registrations)
      notify()

      return () => {
        if (registrations.get(nodeId)?.token !== token) {
          return
        }
        registrations.delete(nodeId)
        snapshot =
          registrations.size > 0 ? getSnapshotFromRegistrations(registrations) : EMPTY_METADATA
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

function getSnapshotFromRegistrations(
  registrations: ReadonlyMap<string, CanvasNodeResizeMetadataRegistration>,
): CanvasNodeResizeMetadataSnapshot {
  return new Map(
    Array.from(registrations, ([nodeId, registration]) => [nodeId, registration.metadata]),
  )
}
