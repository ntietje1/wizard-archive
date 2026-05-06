import { useEffect, useMemo, useRef } from 'react'
import { useCanvasScreenSpaceViewport } from './canvas-screen-space-overlay-utils'
import type { RemoteUser } from '../utils/canvas-awareness-types'
import { getContrastColor } from '~/shared/utils/color'
import { useSpringPosition } from '~/shared/hooks/useSpringPosition'

function CursorIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ display: 'block' }}>
      <path
        d="M0.928 0.32L15.168 10.688C15.552 10.944 15.36 11.552 14.896 11.552H8.448L5.216 19.168C5.072 19.52 4.576 19.52 4.432 19.168L0.576 0.896C0.464 0.48 0.608 0.112 0.928 0.32Z"
        fill={color}
      />
      <path
        d="M0.928 0.32L15.168 10.688C15.552 10.944 15.36 11.552 14.896 11.552H8.448L5.216 19.168C5.072 19.52 4.576 19.52 4.432 19.168L0.576 0.896C0.464 0.48 0.608 0.112 0.928 0.32Z"
        stroke="white"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Clear the GPU hint shortly after cursor updates stop.
const WILL_CHANGE_IDLE_TIMEOUT = 150

function RemoteCursor({ remoteUser }: { remoteUser: RemoteUser }) {
  const elementRef = useRef<HTMLDivElement>(null)
  const viewport = useCanvasScreenSpaceViewport()
  const cursor = remoteUser.cursor
  const cursorX = cursor?.x
  const cursorY = cursor?.y
  const screenCursor = useMemo(
    () =>
      cursorX === undefined || cursorY === undefined
        ? null
        : {
            x: viewport.x + cursorX * viewport.zoom,
            y: viewport.y + cursorY * viewport.zoom,
          },
    [cursorX, cursorY, viewport.x, viewport.y, viewport.zoom],
  )
  const willChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useSpringPosition(screenCursor, elementRef)

  useEffect(() => {
    const element = elementRef.current
    if (!element || !screenCursor) {
      if (willChangeTimeoutRef.current) {
        clearTimeout(willChangeTimeoutRef.current)
        willChangeTimeoutRef.current = null
      }
      if (element) {
        element.style.willChange = ''
      }
      return
    }

    element.style.willChange = 'transform'
    if (willChangeTimeoutRef.current) {
      clearTimeout(willChangeTimeoutRef.current)
    }
    willChangeTimeoutRef.current = setTimeout(() => {
      if (elementRef.current) {
        elementRef.current.style.willChange = ''
      }
      willChangeTimeoutRef.current = null
    }, WILL_CHANGE_IDLE_TIMEOUT)

    return () => {
      if (willChangeTimeoutRef.current) {
        clearTimeout(willChangeTimeoutRef.current)
        willChangeTimeoutRef.current = null
      }
    }
  }, [screenCursor])

  if (!screenCursor) return null

  return (
    <div
      ref={elementRef}
      className="pointer-events-none absolute left-0 top-0 z-[1000]"
      data-testid="canvas-remote-cursor"
      data-remote-client-id={remoteUser.clientId}
    >
      <CursorIcon color={remoteUser.user.color} />
      <NameLabel name={remoteUser.user.name} color={remoteUser.user.color} />
    </div>
  )
}

function NameLabel({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="ml-3 -mt-0.5 w-fit whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] leading-4 font-medium"
      style={{
        backgroundColor: color,
        color: getContrastColor(color),
      }}
    >
      {name}
    </div>
  )
}

export function CanvasRemoteCursors({ remoteUsers }: { remoteUsers: Array<RemoteUser> }) {
  return (
    <>
      {remoteUsers.map((user) => (
        <RemoteCursor key={user.clientId} remoteUser={user} />
      ))}
    </>
  )
}
