import { useEffect, useState } from 'react'
import { pointsToPathD } from './canvas-stroke-utils'
import type { StrokeData } from './canvas-stroke-utils'
import type { RemoteUser } from './canvas-awareness-types'
import type * as Y from 'yjs'
import { useCanvasToolStore } from '~/features/editor/stores/canvas-tool-store'

function yMapToArray<T>(map: Y.Map<T>): Array<T> {
  const items: Array<T> = []
  map.forEach((value) => items.push(value))
  return items
}

const HIT_AREA_EXTRA = 8

interface CanvasStrokesProps {
  strokesMap: Y.Map<StrokeData>
  remoteUsers: Array<RemoteUser>
  interactive: boolean
}

export function CanvasStrokes({
  strokesMap,
  remoteUsers,
  interactive,
}: CanvasStrokesProps) {
  const [strokes, setStrokes] = useState<Array<StrokeData>>(() =>
    yMapToArray(strokesMap),
  )

  const erasingStrokeIds = useCanvasToolStore((s) => s.erasingStrokeIds)
  const selectedStrokeIds = useCanvasToolStore((s) => s.selectedStrokeIds)
  const localDrawing = useCanvasToolStore((s) => s.localDrawing)
  const clickStroke = useCanvasToolStore((s) => s.clickStroke)

  useEffect(() => {
    const handler = () => setStrokes(yMapToArray(strokesMap))
    strokesMap.observe(handler)
    return () => strokesMap.unobserve(handler)
  }, [strokesMap])

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {strokes.map((stroke) => {
        const d = pointsToPathD(stroke.points, stroke.size)
        if (!d) return null
        const isErasing = erasingStrokeIds.has(stroke.id)
        const isSelected = selectedStrokeIds.has(stroke.id)
        return (
          <g key={stroke.id}>
            {interactive && (
              <path
                d={d}
                fill="transparent"
                stroke="transparent"
                strokeWidth={stroke.size + HIT_AREA_EXTRA}
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  clickStroke(stroke.id, e.shiftKey)
                }}
              />
            )}
            <path d={d} fill={stroke.color} opacity={isErasing ? 0.3 : 1} />
            {isSelected && (
              <path
                d={d}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            )}
          </g>
        )
      })}

      {remoteUsers.map((user) => {
        if (!user.drawing || user.drawing.points.length < 2) return null
        const d = pointsToPathD(user.drawing.points, user.drawing.size)
        if (!d) return null
        return (
          <path
            key={`remote-${user.clientId}`}
            d={d}
            fill={user.drawing.color}
            opacity={0.7}
          />
        )
      })}

      {localDrawing && localDrawing.points.length >= 2 && (
        <path
          d={pointsToPathD(localDrawing.points, localDrawing.size)}
          fill={localDrawing.color}
        />
      )}
    </svg>
  )
}
