import type { Id } from 'convex/_generated/dataModel'
import { parseCanvasViewport } from '~/features/canvas/domain/validation'
import { logger } from '~/shared/utils/logger'
import { readPersistedJson, writePersistedJson } from '~/shared/storage/persisted-storage'

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

  return readPersistedJson(
    getCanvasViewportStorageKey(canvasId),
    DEFAULT_CANVAS_VIEWPORT,
    parseCanvasViewport,
  )
}

export function savePersistedCanvasViewport(
  canvasId: Id<'sidebarItems'>,
  viewport: PersistedCanvasViewport,
): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    writePersistedJson(getCanvasViewportStorageKey(canvasId), viewport, {
      deferNotification: true,
    })
  } catch (error) {
    logger.debug(error)
  }
}

function getCanvasViewportStorageKey(canvasId: Id<'sidebarItems'>): string {
  return `canvas-viewport-${canvasId}`
}
