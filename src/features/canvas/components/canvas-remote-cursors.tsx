import { useEffect, useLayoutEffect, useRef } from 'react'
import { useNodes } from '@xyflow/react'
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

const PIN_LERP_DURATION = 200
// Clear the GPU hint shortly after cursor updates stop so it matches the drag lerp timing.
const WILL_CHANGE_IDLE_TIMEOUT = 150

function RemoteCursor({ remoteUser }: { remoteUser: RemoteUser }) {
  const elementRef = useRef<HTMLDivElement>(null)
  const isDragging = !!(remoteUser.dragging && Object.keys(remoteUser.dragging).length > 0)
  const nodes = useNodes()
  const wasDraggingRef = useRef(false)
  const lerpRef = useRef<{
    from: { x: number; y: number }
    startTime: number
  } | null>(null)
  const pinnedRef = useRef<{ x: number; y: number } | null>(null)
  const rafIdRef = useRef<number>(0)
  const animatedPosRef = useRef<{ x: number; y: number } | null>(null)
  const willChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  let pinnedPosition: { x: number; y: number } | null = null
  if (isDragging && remoteUser.cursor && remoteUser.dragging) {
    const entries = Object.entries(remoteUser.dragging)
    if (entries.length > 0) {
      const [refNodeId, refDragPos] = entries[0]
      const node = nodes.find((n) => n.id === refNodeId)
      if (node) {
        pinnedPosition = {
          x: node.position.x + (remoteUser.cursor.x - refDragPos.x),
          y: node.position.y + (remoteUser.cursor.y - refDragPos.y),
        }
      }
    }
  }

  const pinnedX = pinnedPosition?.x ?? null
  const pinnedY = pinnedPosition?.y ?? null

  useLayoutEffect(() => {
    pinnedRef.current = pinnedPosition

    if (isDragging && !wasDraggingRef.current && animatedPosRef.current) {
      lerpRef.current = {
        from: { ...animatedPosRef.current },
        startTime: performance.now(),
      }
    }
    wasDraggingRef.current = isDragging
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, pinnedX, pinnedY])

  useSpringPosition(isDragging ? null : remoteUser.cursor, elementRef)

  useEffect(() => {
    const element = elementRef.current
    if (!element || !remoteUser.cursor) {
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
    willChangeTimeoutRef.current = setTimeout(
      () => {
        if (elementRef.current) {
          elementRef.current.style.willChange = ''
        }
        willChangeTimeoutRef.current = null
      },
      isDragging ? PIN_LERP_DURATION : WILL_CHANGE_IDLE_TIMEOUT,
    )

    return () => {
      if (willChangeTimeoutRef.current) {
        clearTimeout(willChangeTimeoutRef.current)
        willChangeTimeoutRef.current = null
      }
    }
  }, [remoteUser.cursor, isDragging])

  useEffect(() => {
    if (!isDragging || !remoteUser.cursor) {
      lerpRef.current = null
      return
    }

    const animate = () => {
      const pinned = pinnedRef.current
      const currentElement = elementRef.current
      if (!pinned || !currentElement) return

      const lerp = lerpRef.current
      let x: number
      let y: number
      if (lerp) {
        const t = Math.min((performance.now() - lerp.startTime) / PIN_LERP_DURATION, 1)
        const ease = t * (2 - t)
        x = lerp.from.x + (pinned.x - lerp.from.x) * ease
        y = lerp.from.y + (pinned.y - lerp.from.y) * ease
        if (t >= 1) lerpRef.current = null
      } else {
        x = pinned.x
        y = pinned.y
      }
      animatedPosRef.current = { x, y }
      currentElement.style.transform = `translate(${x}px, ${y}px)`

      rafIdRef.current = requestAnimationFrame(animate)
    }

    rafIdRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafIdRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteUser.cursor?.x, remoteUser.cursor?.y, isDragging])

  if (!remoteUser.cursor) return null

  return (
    <div
      ref={elementRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <CursorIcon color={remoteUser.user.color} />
      <NameLabel name={remoteUser.user.name} color={remoteUser.user.color} />
    </div>
  )
}

function NameLabel({ name, color }: { name: string; color: string }) {
  return (
    <div
      style={{
        marginLeft: 12,
        marginTop: -2,
        padding: '2px 6px',
        borderRadius: 4,
        backgroundColor: color,
        color: getContrastColor(color),
        fontSize: 12,
        fontWeight: 500,
        lineHeight: '16px',
        whiteSpace: 'nowrap',
        width: 'fit-content',
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
