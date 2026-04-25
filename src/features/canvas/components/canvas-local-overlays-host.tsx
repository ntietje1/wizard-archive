import { CanvasDragSnapOverlay } from './canvas-drag-snap-overlay'
import { useContext, useEffect, useRef } from 'react'
import { CanvasEngineContext } from '../react/canvas-engine-context-value'
import { canvasToolLocalOverlayLayers } from '../tools/canvas-tool-modules'

export function CanvasLocalOverlaysHost() {
  const canvasEngine = useContext(CanvasEngineContext)
  const viewportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!canvasEngine) {
      return undefined
    }

    const unregister = canvasEngine.registerViewportOverlayElement(viewportRef.current)
    canvasEngine.scheduleViewportTransform(canvasEngine.getSnapshot().viewport)
    canvasEngine.flushRenderScheduler()
    return unregister
  }, [canvasEngine])

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 4 }}>
      <div
        ref={viewportRef}
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
