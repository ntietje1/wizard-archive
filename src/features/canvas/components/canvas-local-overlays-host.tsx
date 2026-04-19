import { useViewport } from '@xyflow/react'
import { getCanvasToolLocalOverlayLayers } from '../tools/canvas-tool-modules'

export function CanvasLocalOverlaysHost() {
  const viewport = useViewport()
  const localOverlayLayers = getCanvasToolLocalOverlayLayers()

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 4 }}>
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {localOverlayLayers.map(({ key, Layer }) => (
          <Layer key={key} />
        ))}
      </div>
    </div>
  )
}
