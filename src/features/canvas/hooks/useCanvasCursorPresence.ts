import throttle from 'lodash-es/throttle'
import { useEffect, useRef } from 'react'
import type { CanvasCoreAwarenessWriter } from '../tools/canvas-tool-types'
import type { ReactFlowInstance } from '@xyflow/react'
import type { MouseEvent as ReactMouseEvent } from 'react'

const CURSOR_UPDATE_THROTTLE_MS = 75

interface UseCanvasCursorPresenceOptions {
  reactFlowInstance: ReactFlowInstance
  awareness: CanvasCoreAwarenessWriter
}

export function useCanvasCursorPresence({
  reactFlowInstance,
  awareness,
}: UseCanvasCursorPresenceOptions) {
  const awarenessRef = useRef(awareness)
  awarenessRef.current = awareness

  const reactFlowInstanceRef = useRef(reactFlowInstance)
  reactFlowInstanceRef.current = reactFlowInstance

  const throttledSetCursorRef = useRef(
    throttle((clientX: number, clientY: number) => {
      awarenessRef.current.setLocalCursor(
        reactFlowInstanceRef.current.screenToFlowPosition({
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
