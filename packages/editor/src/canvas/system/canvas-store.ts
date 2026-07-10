import type {
  CanvasEngine,
  CanvasEngineEquality,
  CanvasEngineListener,
  CanvasEngineSnapshot,
} from './canvas-engine-types'
import type { CanvasViewport } from '../types/canvas-domain-types'

type CanvasStore = Pick<
  CanvasEngine,
  | 'getSnapshot'
  | 'subscribe'
  | 'subscribeViewportChange'
  | 'subscribeViewportCommit'
  | 'subscribeSelector'
  | 'destroy'
> & {
  setSnapshot: (
    snapshot: Omit<CanvasEngineSnapshot, 'version'>,
    options?: { incrementVersion?: boolean; notify?: boolean },
  ) => void
  notify: () => void
  emitViewportChange: (viewport: CanvasViewport) => void
  emitViewportCommit: (viewport: CanvasViewport) => void
}

type CanvasViewportChangeListener = Parameters<CanvasEngine['subscribeViewportChange']>[0]
type CanvasViewportCommitListener = Parameters<CanvasEngine['subscribeViewportCommit']>[0]

export function createCanvasStore(initialSnapshot: CanvasEngineSnapshot): CanvasStore {
  let snapshot = initialSnapshot
  const listeners = new Set<CanvasEngineListener>()
  const viewportChangeListeners = new Set<CanvasViewportChangeListener>()
  const viewportCommitListeners = new Set<CanvasViewportCommitListener>()

  const emit = () => notifyListeners(listeners, 'Canvas store listener failed')

  return {
    getSnapshot: () => snapshot,
    setSnapshot: (next, options = {}) => {
      snapshot = {
        ...next,
        version: options.incrementVersion ? snapshot.version + 1 : snapshot.version,
      }

      if (options.notify) {
        emit()
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    notify: emit,
    subscribeViewportChange: (listener) => {
      viewportChangeListeners.add(listener)
      return () => {
        viewportChangeListeners.delete(listener)
      }
    },
    subscribeViewportCommit: (listener) => {
      viewportCommitListeners.add(listener)
      return () => {
        viewportCommitListeners.delete(listener)
      }
    },
    subscribeSelector: (selector, listener, equality = Object.is) => {
      return subscribeWithSelector({
        getSnapshot: () => snapshot,
        subscribe: (selectorListener) => {
          listeners.add(selectorListener)
          return () => {
            listeners.delete(selectorListener)
          }
        },
        selector,
        listener,
        equality,
      })
    },
    emitViewportChange: (viewport) => {
      notifyListeners(viewportChangeListeners, 'Canvas viewport change listener failed', viewport)
    },
    emitViewportCommit: (viewport) => {
      notifyListeners(viewportCommitListeners, 'Canvas viewport commit listener failed', viewport)
    },
    destroy: () => {
      listeners.clear()
      viewportChangeListeners.clear()
      viewportCommitListeners.clear()
    },
  }
}

function notifyListeners<TArgs extends ReadonlyArray<unknown>>(
  listeners: ReadonlySet<(...args: TArgs) => void>,
  failureMessage: string,
  ...args: TArgs
) {
  for (const listener of Array.from(listeners)) {
    try {
      listener(...args)
    } catch (error) {
      console.error(failureMessage, error)
    }
  }
}

function subscribeWithSelector<T>({
  getSnapshot,
  subscribe,
  selector,
  listener,
  equality,
}: {
  getSnapshot: () => CanvasEngineSnapshot
  subscribe: (listener: CanvasEngineListener) => () => void
  selector: (snapshot: CanvasEngineSnapshot) => T
  listener: (next: T, previous: T) => void
  equality: CanvasEngineEquality<T>
}) {
  let selected = selector(getSnapshot())
  return subscribe(() => {
    const next = selector(getSnapshot())
    if (equality(selected, next)) {
      return
    }

    const previous = selected
    selected = next
    listener(next, previous)
  })
}
