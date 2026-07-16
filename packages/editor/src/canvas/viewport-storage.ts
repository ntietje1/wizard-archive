import { DEFAULT_CANVAS_VIEWPORT } from './canvas-viewport'
import type { CanvasViewport } from './interaction-types'
import type { ResourceId } from '../resources/domain-id'

type CanvasViewportStorage = Pick<Storage, 'getItem' | 'setItem'>

const CANVAS_VIEWPORT_KEY_PREFIX = 'wizard-archive:canvas-viewport:v1:'

export function loadCanvasViewport(
  storage: CanvasViewportStorage,
  resourceId: ResourceId,
): CanvasViewport {
  try {
    const stored = storage.getItem(`${CANVAS_VIEWPORT_KEY_PREFIX}${resourceId}`)
    if (stored === null) return DEFAULT_CANVAS_VIEWPORT
    const value = JSON.parse(stored)
    if (
      typeof value === 'object' &&
      value !== null &&
      Object.keys(value).length === 3 &&
      Number.isFinite(value.x) &&
      Number.isFinite(value.y) &&
      Number.isFinite(value.zoom) &&
      value.zoom >= 0.1 &&
      value.zoom <= 4
    ) {
      return { x: value.x, y: value.y, zoom: value.zoom }
    }
  } catch {
    return DEFAULT_CANVAS_VIEWPORT
  }
  return DEFAULT_CANVAS_VIEWPORT
}

export function saveCanvasViewport(
  storage: CanvasViewportStorage,
  resourceId: ResourceId,
  viewport: CanvasViewport,
): void {
  try {
    storage.setItem(`${CANVAS_VIEWPORT_KEY_PREFIX}${resourceId}`, JSON.stringify(viewport))
  } catch {
    return
  }
}
