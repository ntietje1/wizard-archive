import { useContext, useSyncExternalStore } from 'react'
import { CanvasRemoteCursors } from './canvas-remote-cursors'
import { CanvasEngineContext } from '../react/canvas-engine-context-value'
import { canvasNodeAwarenessLayers } from '../nodes/canvas-node-modules'
import { canvasToolAwarenessLayers } from '../tools/canvas-tool-modules'
import type { RemoteUser } from '../utils/canvas-awareness-types'

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 }

export function CanvasAwarenessHost({ remoteUsers }: { remoteUsers: Array<RemoteUser> }) {
  const viewport = useCanvasViewportSnapshot()

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 5 }}>
      <div
        data-testid="awareness-layer-container"
        className="absolute inset-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {canvasToolAwarenessLayers.map(({ key, Layer }) => (
          <Layer key={key} remoteUsers={remoteUsers} />
        ))}
        {canvasNodeAwarenessLayers.map(({ key, Layer }) => (
          <Layer key={key} remoteUsers={remoteUsers} />
        ))}
      </div>
      <CanvasRemoteCursors remoteUsers={remoteUsers} />
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
