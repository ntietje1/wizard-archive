import type { Id } from 'convex/_generated/dataModel'
import { useEffect, useRef } from 'react'
import { createCanvasViewportPersistence } from './interaction/canvas-viewport-persistence'
import { createCanvasDomRuntime } from '../system/canvas-dom-runtime'
import { createCanvasEngine } from '../system/canvas-engine'
import { createCanvasViewportController } from '../system/canvas-viewport-controller'
import type { CanvasViewport } from '../types/canvas-domain-types'

interface UseCanvasCoreRuntimeOptions {
  canvasId: Id<'sidebarItems'>
  initialViewport: CanvasViewport
}

export function useCanvasCoreRuntime({ canvasId, initialViewport }: UseCanvasCoreRuntimeOptions) {
  const initialViewportRef = useRef(initialViewport)
  const domRuntimeRef = useRef<ReturnType<typeof createCanvasDomRuntime> | null>(null)
  domRuntimeRef.current ??= createCanvasDomRuntime()
  const domRuntime = domRuntimeRef.current
  const canvasEngineRef = useRef<ReturnType<typeof createCanvasEngine> | null>(null)
  canvasEngineRef.current ??= createCanvasEngine({ domRuntime })
  const canvasEngine = canvasEngineRef.current
  const canvasSurfaceRef = useRef<HTMLDivElement>(null)
  const viewportControllerRef = useRef<ReturnType<typeof createCanvasViewportController> | null>(
    null,
  )
  viewportControllerRef.current ??= createCanvasViewportController({
    canvasEngine,
    domRuntime,
    getSurfaceElement: () => canvasSurfaceRef.current,
  })
  const viewportController = viewportControllerRef.current

  useEffect(() => () => domRuntime.destroy(), [domRuntime])
  useEffect(() => () => canvasEngine.destroy(), [canvasEngine])
  useEffect(() => () => viewportController.destroy(), [viewportController])

  useEffect(() => {
    viewportController.syncFromDocumentOrAdapter({
      x: initialViewport.x,
      y: initialViewport.y,
      zoom: initialViewport.zoom,
    })
  }, [initialViewport.x, initialViewport.y, initialViewport.zoom, viewportController])

  useEffect(
    () =>
      createCanvasViewportPersistence({
        canvasEngine,
        canvasId,
        initialViewport: {
          x: initialViewportRef.current.x,
          y: initialViewportRef.current.y,
          zoom: initialViewportRef.current.zoom,
        },
      }),
    [canvasEngine, canvasId],
  )

  return {
    canvasEngine,
    canvasSurfaceRef,
    domRuntime,
    viewportController,
  }
}
