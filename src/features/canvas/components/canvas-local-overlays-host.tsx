import { CanvasDragSnapOverlay } from './canvas-drag-snap-overlay'
import { useContext, useSyncExternalStore } from 'react'
import { CanvasEngineContext } from '../react/canvas-engine-context-value'
import { canvasToolLocalOverlayLayers } from '../tools/canvas-tool-modules'

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 }

export function CanvasLocalOverlaysHost() {
  const viewport = useCanvasViewportSnapshot()

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 4 }}>
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
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

function useCanvasViewportSnapshot() {
  const canvasEngine = useContext(CanvasEngineContext)
  return useSyncExternalStore(
    canvasEngine?.subscribe ?? subscribeToNoop,
    () => canvasEngine?.getSnapshot().viewport ?? DEFAULT_VIEWPORT,
    () => DEFAULT_VIEWPORT,
  )
}

function subscribeToNoop() {
  return () => undefined
}
