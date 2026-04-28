import type { Id } from 'convex/_generated/dataModel'
import { parseCanvasViewport } from 'convex/canvases/validation'
import { logger } from '~/shared/utils/logger'

const DEFAULT_CANVAS_VIEWPORT = {
  x: 0,
  y: 0,
  zoom: 1,
} satisfies PersistedCanvasViewport

export interface PersistedCanvasViewport {
  x: number
  y: number
  zoom: number
}

export function loadPersistedCanvasViewport(canvasId: Id<'sidebarItems'>): PersistedCanvasViewport {
  if (typeof window === 'undefined') {
    return DEFAULT_CANVAS_VIEWPORT
  }

  try {
    const rawValue = window.localStorage.getItem(getCanvasViewportStorageKey(canvasId))
    if (!rawValue) {
      return DEFAULT_CANVAS_VIEWPORT
    }

    return parseCanvasViewport(JSON.parse(rawValue)) ?? DEFAULT_CANVAS_VIEWPORT
  } catch (error) {
    logger.debug(error)
    return DEFAULT_CANVAS_VIEWPORT
  }
}

export function savePersistedCanvasViewport(
  canvasId: Id<'sidebarItems'>,
  viewport: PersistedCanvasViewport,
): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const key = getCanvasViewportStorageKey(canvasId)
    const serializedViewport = JSON.stringify(viewport)
    window.localStorage.setItem(key, serializedViewport)
    queueMicrotask(() => {
      window.dispatchEvent(
        new CustomEvent('localStorageChange', {
          detail: { key, newValue: serializedViewport },
        }),
      )
    })
  } catch (error) {
    logger.debug(error)
  }
}

function getCanvasViewportStorageKey(canvasId: Id<'sidebarItems'>): string {
  return `canvas-viewport-${canvasId}`
}
