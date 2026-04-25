import type { Id } from 'convex/_generated/dataModel'
import { savePersistedCanvasViewport } from './canvas-viewport-storage'
import type { CanvasEngine } from '../../system/canvas-engine'
import type { PersistedCanvasViewport } from './canvas-viewport-storage'

const VIEWPORT_SAVE_DEBOUNCE_MS = 250

export function createCanvasViewportPersistence({
  canvasEngine,
  canvasId,
  initialViewport,
}: {
  canvasEngine: CanvasEngine
  canvasId: Id<'sidebarItems'>
  initialViewport: PersistedCanvasViewport
}) {
  let lastSavedViewport = initialViewport
  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  const clearSaveTimeout = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
  }

  const unsubscribe = canvasEngine.subscribeViewportCommit((viewport) => {
    const nextViewport = {
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom,
    } satisfies PersistedCanvasViewport

    if (persistedCanvasViewportsEqual(lastSavedViewport, nextViewport)) {
      return
    }

    clearSaveTimeout()

    saveTimeout = setTimeout(() => {
      savePersistedCanvasViewport(canvasId, nextViewport)
      lastSavedViewport = nextViewport
      saveTimeout = null
    }, VIEWPORT_SAVE_DEBOUNCE_MS)
  })

  return () => {
    unsubscribe()
    clearSaveTimeout()
  }
}

function persistedCanvasViewportsEqual(
  left: PersistedCanvasViewport,
  right: PersistedCanvasViewport,
): boolean {
  return left.x === right.x && left.y === right.y && left.zoom === right.zoom
}
