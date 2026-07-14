import type { ResourceId } from '../resources/domain-id'
type FileSystemLoadStatus = 'pending' | 'error' | 'success'

export interface FileSystemLoadState {
  activeStatus: FileSystemLoadStatus
  activeError: Error | null
  refreshActive: () => Promise<unknown>
  trashStatus: FileSystemLoadStatus
  trashError: Error | null
  refreshTrash: () => Promise<unknown>
}

export type ItemContentLoadState<T> =
  | {
      status: 'idle'
      item: null
      isPending: false
      error: null
    }
  | {
      status: 'loading'
      item: null
      isPending: true
      error: null
    }
  | {
      status: 'ready'
      item: T
      isPending: false
      error: null
    }
  | {
      status: 'not_found'
      item: null
      isPending: false
      error: null
    }
  | {
      status: 'error'
      item: null
      isPending: false
      error: unknown
    }

export function createItemContentLoadState<T>({
  error,
  item,
  itemId,
  isPending,
}: {
  error?: unknown
  item: T | null | undefined
  itemId: ResourceId | undefined
  isPending: boolean
}): ItemContentLoadState<T> {
  if (!itemId) {
    return { status: 'idle', item: null, isPending: false, error: null }
  }
  if (isPending) {
    return { status: 'loading', item: null, isPending: true, error: null }
  }
  if (error !== null && error !== undefined) {
    return { status: 'error', item: null, isPending: false, error }
  }
  if (item === null || item === undefined) {
    return { status: 'not_found', item: null, isPending: false, error: null }
  }
  return { status: 'ready', item, isPending: false, error: null }
}

export function narrowItemContentLoadState<T, U extends T>(
  state: ItemContentLoadState<T>,
  isTarget: (item: T) => item is U,
): ItemContentLoadState<U> {
  if (state.status !== 'ready') return state
  if (!isTarget(state.item)) {
    return { status: 'not_found', item: null, isPending: false, error: null }
  }
  return { ...state, item: state.item }
}
