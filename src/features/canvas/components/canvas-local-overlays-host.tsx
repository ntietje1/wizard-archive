import { CanvasDragSnapOverlay } from './canvas-drag-snap-overlay'
import { useEffect, useRef } from 'react'
import { useCanvasEngine } from '../react/use-canvas-engine'
import { canvasToolLocalOverlayLayers } from '../tools/canvas-tool-modules'

export function CanvasLocalOverlaysHost() {
  const canvasEngine = useCanvasEngine()
  const viewportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const unregister = viewportRef.current
      ? canvasEngine.registerViewportOverlayElement(viewportRef.current)
      : undefined
    canvasEngine.scheduleViewportTransform(canvasEngine.getSnapshot().viewport)
    canvasEngine.flushRenderScheduler()
    return unregister
  }, [canvasEngine])

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 4 }}>
      <div
        ref={viewportRef}
        data-testid="local-overlay-transform-container"
        className="absolute inset-0"
        style={{
          backfaceVisibility: 'hidden',
          transformOrigin: '0 0',
        }}
      >
        {canvasToolLocalOverlayLayers.map(({ key, Layer }) => (
          <Layer key={key} />
        ))}
        <CanvasDragSnapOverlay />
      </div>
    </div>
  )
}
