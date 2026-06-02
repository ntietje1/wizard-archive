import { useLayoutEffect } from 'react'
import type { CanvasEngine } from '../system/canvas-engine-types'
import type { CanvasViewport } from '../types/canvas-domain-types'
import type { RefObject } from 'react'

const CANVAS_BACKGROUND_GRID_SIZE = 36

function applyCanvasBackgroundViewport(element: HTMLElement | null, viewport: CanvasViewport) {
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

export function useCanvasBackgroundViewport({
  backgroundRef,
  canvasEngine,
}: {
  backgroundRef: RefObject<HTMLElement | null>
  canvasEngine: CanvasEngine
}) {
  useLayoutEffect(() => {
    const syncBackground = () => {
      applyCanvasBackgroundViewport(backgroundRef.current, canvasEngine.getSnapshot().viewport)
    }

    syncBackground()
    return canvasEngine.subscribeViewportChange(syncBackground)
  }, [backgroundRef, canvasEngine])
}

function formatCssPixel(value: number) {
  return `${Math.round(value * 1000) / 1000}px`
}
