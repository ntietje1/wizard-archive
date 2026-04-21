import type { Id } from 'convex/_generated/dataModel'
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

    const parsedValue = JSON.parse(rawValue)
    return isPersistedCanvasViewport(parsedValue) ? parsedValue : DEFAULT_CANVAS_VIEWPORT
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

function isPersistedCanvasViewport(value: unknown): value is PersistedCanvasViewport {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.x === 'number' &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === 'number' &&
    Number.isFinite(candidate.y) &&
    typeof candidate.zoom === 'number' &&
    Number.isFinite(candidate.zoom)
  )
}
