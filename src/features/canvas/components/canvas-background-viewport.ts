import type { CanvasViewport } from '../types/canvas-domain-types'

const CANVAS_BACKGROUND_GRID_SIZE = 36

export function applyCanvasBackgroundViewport(
  element: HTMLElement | null,
  viewport: CanvasViewport,
) {
  if (!element) {
    return
  }

  const zoom = viewport.zoom > 0 && Number.isFinite(viewport.zoom) ? viewport.zoom : 1
  const x = Number.isFinite(viewport.x) ? viewport.x : 0
  const y = Number.isFinite(viewport.y) ? viewport.y : 0
  const scaledGridSize = formatCssPixel(CANVAS_BACKGROUND_GRID_SIZE * Math.sqrt(zoom))
  element.style.backgroundSize = `${scaledGridSize} ${scaledGridSize}`
  element.style.backgroundPosition = `${formatCssPixel(x)} ${formatCssPixel(y)}`
}

function formatCssPixel(value: number) {
  return `${Math.round(value * 1000) / 1000}px`
}
