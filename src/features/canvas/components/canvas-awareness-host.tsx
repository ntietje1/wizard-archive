import { useViewport } from '@xyflow/react'
import { CanvasRemoteCursors } from './canvas-remote-cursors'
import { canvasNodeModules } from './nodes/canvas-node-registry'
import { canvasToolModules } from '../tools/canvas-tool-modules'
import type { CanvasAwarenessCapability } from '../tools/canvas-tool-types'
import type { RemoteUser } from '../utils/canvas-awareness-types'

export function CanvasAwarenessHost({ remoteUsers }: { remoteUsers: Array<RemoteUser> }) {
  const viewport = useViewport()

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 5 }}>
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {canvasToolModules.map((module) =>
          module.awareness?.Layer ? (
            <CanvasAwarenessLayer
              key={module.id}
              Layer={module.awareness.Layer}
              remoteUsers={remoteUsers}
            />
          ) : null,
        )}
        {canvasNodeModules.map((module) =>
          module.awareness?.Layer ? (
            <CanvasAwarenessLayer
              key={module.type}
              Layer={module.awareness.Layer}
              remoteUsers={remoteUsers}
            />
          ) : null,
        )}
      </div>
      <CanvasRemoteCursors remoteUsers={remoteUsers} />
    </div>
  )
}

function CanvasAwarenessLayer({
  Layer,
  remoteUsers,
}: {
  Layer: NonNullable<CanvasAwarenessCapability['Layer']>
  remoteUsers: Array<RemoteUser>
}) {
  return <Layer remoteUsers={remoteUsers} />
}
