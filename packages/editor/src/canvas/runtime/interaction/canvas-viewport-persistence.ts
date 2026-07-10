import type { CanvasEngine } from '../../system/canvas-engine-types'
import type { CanvasViewportStore, PersistedCanvasViewport } from './canvas-viewport-storage'
import type { SidebarItemId } from '../../../../../../shared/common/ids'

const VIEWPORT_SAVE_DEBOUNCE_MS = 250

export function createCanvasViewportPersistence({
  canvasEngine,
  canvasId,
  initialViewport,
  viewportStore,
}: {
  canvasEngine: CanvasEngine
  canvasId: SidebarItemId
  initialViewport: PersistedCanvasViewport
  viewportStore: CanvasViewportStore
}) {
  let lastSavedViewport = initialViewport
  let pendingViewport: PersistedCanvasViewport | null = null
  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  const savePendingViewport = () => {
    if (!pendingViewport) {
      return
    }

    viewportStore.saveCanvasViewport(canvasId, pendingViewport)
    lastSavedViewport = pendingViewport
    pendingViewport = null
  }

  const clearSaveTimeout = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
  }

  const flushPendingViewport = () => {
    try {
      savePendingViewport()
    } finally {
      clearSaveTimeout()
    }
  }

  const unsubscribe = canvasEngine.subscribeViewportCommit((viewport) => {
    const nextViewport = {
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom,
    } satisfies PersistedCanvasViewport

    if (persistedCanvasViewportsEqual(lastSavedViewport, nextViewport)) {
      clearSaveTimeout()
      pendingViewport = null
      return
    }

    clearSaveTimeout()
    pendingViewport = nextViewport

    saveTimeout = setTimeout(() => {
      savePendingViewport()
      saveTimeout = null
    }, VIEWPORT_SAVE_DEBOUNCE_MS)
  })

  window.addEventListener('pagehide', flushPendingViewport)
  window.addEventListener('beforeunload', flushPendingViewport)

  const removeLifecycleListeners = () => {
    window.removeEventListener('pagehide', flushPendingViewport)
    window.removeEventListener('beforeunload', flushPendingViewport)
  }

  return () => {
    try {
      flushPendingViewport()
    } finally {
      unsubscribe()
      removeLifecycleListeners()
    }
  }
}

function persistedCanvasViewportsEqual(
  left: PersistedCanvasViewport,
  right: PersistedCanvasViewport,
): boolean {
  return left.x === right.x && left.y === right.y && left.zoom === right.zoom
}
