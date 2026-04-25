import throttle from 'lodash-es/throttle'
import { useEffect, useRef } from 'react'
import type { CanvasCoreAwarenessWriter } from '../../tools/canvas-tool-types'
import type { XYPosition } from '@xyflow/react'
import type { MouseEvent as ReactMouseEvent } from 'react'

const CURSOR_UPDATE_THROTTLE_MS = 75

interface UseCanvasCursorPresenceOptions {
  screenToCanvasPosition: (position: XYPosition) => XYPosition
  awareness: CanvasCoreAwarenessWriter
}

export function useCanvasCursorPresence({
  screenToCanvasPosition,
  awareness,
}: UseCanvasCursorPresenceOptions) {
  const awarenessRef = useRef(awareness)
  awarenessRef.current = awareness

  const screenToCanvasPositionRef = useRef(screenToCanvasPosition)
  screenToCanvasPositionRef.current = screenToCanvasPosition

  const throttledSetCursorRef = useRef(
    throttle((clientX: number, clientY: number) => {
      awarenessRef.current.setLocalCursor(
        screenToCanvasPositionRef.current({
          x: clientX,
          y: clientY,
        }),
      )
    }, CURSOR_UPDATE_THROTTLE_MS),
  )

  useEffect(() => () => throttledSetCursorRef.current.cancel(), [])

  const onMouseMove = (event: ReactMouseEvent) => {
    throttledSetCursorRef.current(event.clientX, event.clientY)
  }

  const onMouseLeave = () => {
    throttledSetCursorRef.current.cancel()
    awarenessRef.current.setLocalCursor(null)
  }

  return {
    onMouseMove,
    onMouseLeave,
  }
}
