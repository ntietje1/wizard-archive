import { useViewport } from '@xyflow/react'
import { CanvasRemoteCursors } from './canvas-remote-cursors'
import { getCanvasNodeAwarenessLayers } from '../nodes/canvas-node-registry'
import { getCanvasToolAwarenessLayers } from '../tools/canvas-tool-modules'
import type { RemoteUser } from '../utils/canvas-awareness-types'

export function CanvasAwarenessHost({ remoteUsers }: { remoteUsers: Array<RemoteUser> }) {
  const viewport = useViewport()
  const toolAwarenessLayers = getCanvasToolAwarenessLayers()
  const nodeAwarenessLayers = getCanvasNodeAwarenessLayers()

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 5 }}>
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {toolAwarenessLayers.map(({ key, Layer }) => (
          <Layer key={key} remoteUsers={remoteUsers} />
        ))}
        {nodeAwarenessLayers.map(({ key, Layer }) => (
          <Layer key={key} remoteUsers={remoteUsers} />
        ))}
      </div>
      <CanvasRemoteCursors remoteUsers={remoteUsers} />
    </div>
  )
}
