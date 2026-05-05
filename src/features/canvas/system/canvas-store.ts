import type {
  CanvasEngineEquality,
  CanvasEngineListener,
  CanvasEngineSnapshot,
  CanvasViewportChangeListener,
  CanvasViewportCommitListener,
} from './canvas-engine-types'
import type { CanvasViewport } from '../types/canvas-domain-types'

export interface CanvasStore {
  getSnapshot: () => CanvasEngineSnapshot
  setSnapshot: (
    snapshot: Omit<CanvasEngineSnapshot, 'version'>,
    options?: { incrementVersion?: boolean; notify?: boolean },
  ) => void
  notify: () => void
  subscribe: (listener: CanvasEngineListener) => () => void
  subscribeViewportChange: (listener: CanvasViewportChangeListener) => () => void
  subscribeViewportCommit: (listener: CanvasViewportCommitListener) => () => void
  subscribeSelector: <T>(
    selector: (snapshot: CanvasEngineSnapshot) => T,
    listener: (next: T, previous: T) => void,
    equality?: CanvasEngineEquality<T>,
  ) => () => void
  emitViewportChange: (viewport: CanvasViewport) => void
  emitViewportCommit: (viewport: CanvasViewport) => void
  destroy: () => void
}

export function createCanvasStore(initialSnapshot: CanvasEngineSnapshot): CanvasStore {
  let snapshot = initialSnapshot
  const listeners = new Set<CanvasEngineListener>()
  const viewportChangeListeners = new Set<CanvasViewportChangeListener>()
  const viewportCommitListeners = new Set<CanvasViewportCommitListener>()

  const emit = () => {
    for (const listener of Array.from(listeners)) {
      try {
        listener()
      } catch (error) {
        console.error('Canvas store listener failed', error)
      }
    }
  }

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
      let selected = selector(snapshot)
      return subscribeWithSelector({
        getSnapshot: () => snapshot,
        subscribe: (selectorListener) => {
          listeners.add(selectorListener)
          return () => {
            listeners.delete(selectorListener)
          }
        },
        selector,
        listener: (next) => {
          const previous = selected
          selected = next
          listener(next, previous)
        },
        equality,
      })
    },
    emitViewportChange: (viewport) => {
      for (const listener of Array.from(viewportChangeListeners)) {
        try {
          listener(viewport)
        } catch (error) {
          console.error('Canvas viewport change listener failed', error)
        }
      }
    },
    emitViewportCommit: (viewport) => {
      for (const listener of Array.from(viewportCommitListeners)) {
        try {
          listener(viewport)
        } catch (error) {
          console.error('Canvas viewport commit listener failed', error)
        }
      }
    },
    destroy: () => {
      listeners.clear()
      viewportChangeListeners.clear()
      viewportCommitListeners.clear()
    },
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
  listener: (next: T) => void
  equality: CanvasEngineEquality<T>
}) {
  let selected = selector(getSnapshot())
  return subscribe(() => {
    const next = selector(getSnapshot())
    if (equality(selected, next)) {
      return
    }

    selected = next
    listener(next)
  })
}
