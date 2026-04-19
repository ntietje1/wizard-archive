import { useCanvasInteractionStore } from '../../hooks/useCanvasInteractionStore'
import type { RemoteUser } from '../../utils/canvas-awareness-types'

function normalizeRect(rect: { x: number; y: number; width: number; height: number }) {
  return {
    x: Math.min(rect.x, rect.x + rect.width),
    y: Math.min(rect.y, rect.y + rect.height),
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  }
}

export function SelectAwarenessLayer({ remoteUsers }: { remoteUsers: ReadonlyArray<RemoteUser> }) {
  const selectionDragRect = useCanvasInteractionStore((state) => state.selectionDragRect)
  const localRect = selectionDragRect ? normalizeRect(selectionDragRect) : null

  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {localRect && (
        <rect
          x={localRect.x}
          y={localRect.y}
          width={localRect.width}
          height={localRect.height}
          fill="var(--primary)"
          fillOpacity={0.08}
          stroke="var(--primary)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}

      {remoteUsers.map((remoteUser) => {
        if (!remoteUser.selecting || remoteUser.selecting.type !== 'rect') return null
        const rect = normalizeRect(remoteUser.selecting)
        return (
          <rect
            key={`selection-${remoteUser.clientId}`}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={remoteUser.user.color}
            fillOpacity={0.06}
            stroke={remoteUser.user.color}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )
      })}
    </svg>
  )
}
