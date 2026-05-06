import { CanvasDragSnapOverlay } from './canvas-drag-snap-overlay'
import { canvasToolLocalOverlayLayers } from '../tools/canvas-tool-modules'

export function CanvasLocalOverlaysHost() {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 4 }}>
      <div data-testid="local-overlay-screen-container" className="absolute inset-0">
        {canvasToolLocalOverlayLayers.map(({ key, Layer }) => (
          <Layer key={key} />
        ))}
        <CanvasDragSnapOverlay />
      </div>
    </div>
  )
}
