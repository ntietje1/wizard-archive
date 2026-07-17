import { useEffect, useRef, useState } from 'react'
import { getContrastColor } from '@wizard-archive/ui/utils/color'
import type { ContentCollaboration } from '../resources/content-session-contract'
import type { CanvasViewport } from './interaction-types'
import { readCanvasRemoteCursors } from './canvas-collaboration'
import { useSpringPosition } from './use-spring-position'

type RemoteCursor = ReturnType<typeof readCanvasRemoteCursors>[number]

export function CanvasCollaborationCursors({
  collaboration,
  viewport,
}: {
  collaboration: ContentCollaboration
  viewport: CanvasViewport
}) {
  const [, setRevision] = useState(0)
  const awareness = collaboration.provider.awareness
  useEffect(() => {
    const changed = () => setRevision((revision) => revision + 1)
    awareness.on('change', changed)
    return () => awareness.off('change', changed)
  }, [awareness])

  return readCanvasRemoteCursors(collaboration).map((cursor) => (
    <RemoteCursorView key={cursor.clientId} cursor={cursor} viewport={viewport} />
  ))
}

function RemoteCursorView({
  cursor,
  viewport,
}: {
  cursor: RemoteCursor
  viewport: CanvasViewport
}) {
  const element = useRef<HTMLDivElement>(null)
  const target = {
    x: viewport.x + cursor.point.x * viewport.zoom,
    y: viewport.y + cursor.point.y * viewport.zoom,
  }
  useSpringPosition(target, element)

  return (
    <div
      ref={element}
      aria-label={`${cursor.user.name} cursor`}
      className="pointer-events-none absolute top-0 left-0 z-[1000]"
      data-testid="canvas-remote-cursor"
    >
      <svg aria-hidden="true" className="block h-5 w-4" fill="none" viewBox="0 0 16 20">
        <path
          d="M0.928 0.32L15.168 10.688C15.552 10.944 15.36 11.552 14.896 11.552H8.448L5.216 19.168C5.072 19.52 4.576 19.52 4.432 19.168L0.576 0.896C0.464 0.48 0.608 0.112 0.928 0.32Z"
          fill={cursor.user.color}
          stroke="white"
          strokeLinejoin="round"
          strokeWidth="0.8"
        />
      </svg>
      <span
        className="-mt-0.5 ml-3 block w-fit whitespace-nowrap rounded px-1.5 py-0.5 text-xs leading-4 font-medium"
        style={{
          backgroundColor: cursor.user.color,
          color: getContrastColor(cursor.user.color),
        }}
      >
        {cursor.user.name}
      </span>
    </div>
  )
}
