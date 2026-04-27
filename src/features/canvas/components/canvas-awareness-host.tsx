import { useEffect, useRef } from 'react'
import { CanvasRemoteCursors } from './canvas-remote-cursors'
import { useCanvasEngine } from '../react/use-canvas-engine'
import { useCanvasRuntime } from '../runtime/providers/canvas-runtime'
import { canvasNodeAwarenessLayers } from '../nodes/canvas-node-modules'
import { canvasToolAwarenessLayers } from '../tools/canvas-tool-modules'
import type { RemoteUser } from '../utils/canvas-awareness-types'

export function CanvasAwarenessHost({ remoteUsers }: { remoteUsers: Array<RemoteUser> }) {
  const canvasEngine = useCanvasEngine()
  const { domRuntime } = useCanvasRuntime()
  const viewportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!viewportRef.current) {
      return undefined
    }

    const unregister = domRuntime.registerViewportOverlayElement(viewportRef.current)
    domRuntime.scheduleViewportTransform(canvasEngine.getSnapshot().viewport)
    domRuntime.flushRenderScheduler()
    return unregister
  }, [canvasEngine, domRuntime])

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 5 }}>
      <div
        ref={viewportRef}
        data-testid="awareness-layer-container"
        className="absolute inset-0"
        style={{
          backfaceVisibility: 'hidden',
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
