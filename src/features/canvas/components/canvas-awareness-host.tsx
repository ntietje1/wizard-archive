import { useViewport } from '@xyflow/react'
import { CanvasRemoteCursors } from './canvas-remote-cursors'
import { canvasNodeAwarenessLayers } from '../nodes/canvas-node-modules'
import { canvasToolAwarenessLayers } from '../tools/canvas-tool-modules'
import type { RemoteUser } from '../utils/canvas-awareness-types'

export function CanvasAwarenessHost({ remoteUsers }: { remoteUsers: Array<RemoteUser> }) {
  const viewport = useViewport()

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
