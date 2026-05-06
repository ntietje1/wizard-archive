import { CanvasRemoteCursors } from './canvas-remote-cursors'
import { canvasToolAwarenessLayers } from '../tools/canvas-tool-modules'
import type { RemoteUser } from '../utils/canvas-awareness-types'

export function CanvasAwarenessHost({ remoteUsers }: { remoteUsers: Array<RemoteUser> }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <div data-testid="awareness-layer-container" className="absolute inset-0">
        {canvasToolAwarenessLayers.map(({ key, Layer }) => (
          <Layer key={key} remoteUsers={remoteUsers} />
        ))}
      </div>
      <CanvasRemoteCursors remoteUsers={remoteUsers} />
    </div>
  )
}
