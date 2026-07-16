import { useEffect, useState } from 'react'
import type { ContentCollaboration } from '../resources/content-session-contract'
import { readCanvasRemoteCursors } from './canvas-collaboration'

export function CanvasCollaborationCursors({
  collaboration,
  zoom,
}: {
  collaboration: ContentCollaboration
  zoom: number
}) {
  const [, setRevision] = useState(0)
  const awareness = collaboration.provider.awareness
  useEffect(() => {
    const changed = () => setRevision((revision) => revision + 1)
    awareness.on('change', changed)
    return () => awareness.off('change', changed)
  }, [awareness])

  return readCanvasRemoteCursors(collaboration).map((cursor) => (
    <div
      key={cursor.clientId}
      aria-label={`${cursor.user.name} cursor`}
      className="pointer-events-none absolute left-0 top-0 z-[1000]"
      data-testid="canvas-remote-cursor"
      style={{ transform: `translate(${cursor.point.x}px, ${cursor.point.y}px)` }}
    >
      <div
        className="flex origin-top-left items-start"
        style={{ color: cursor.user.color, transform: `scale(${1 / zoom})` }}
      >
        <span aria-hidden className="text-lg leading-none">
          ◆
        </span>
        <span
          className="mt-3 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium text-white shadow-sm"
          style={{ backgroundColor: cursor.user.color }}
        >
          {cursor.user.name}
        </span>
      </div>
    </div>
  ))
}
