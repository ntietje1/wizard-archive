import { useLayoutEffect } from 'react'
import { applyCanvasBackgroundViewport } from './canvas-background-viewport-style'
import type { CanvasEngine } from '../system/canvas-engine-types'
import type { RefObject } from 'react'

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
