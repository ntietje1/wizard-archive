import { useEffect, useRef } from 'react'
import type { CanvasToolHandlers } from '../../tools/canvas-tool-types'

interface UseCanvasPointerBridgeOptions {
  surfaceRef: React.RefObject<HTMLDivElement | null>
  activeToolHandlers: CanvasToolHandlers
}

export function useCanvasPointerBridge({
  surfaceRef,
  activeToolHandlers,
}: UseCanvasPointerBridgeOptions) {
  const toolHandlersRef = useRef(activeToolHandlers)
  toolHandlersRef.current = activeToolHandlers

  useEffect(() => {
    const surfaceElement = surfaceRef.current
    if (!surfaceElement) return

    let activeToolPointerId: number | null = null
    let activeGestureHandlers: CanvasToolHandlers | null = null
    const capture = true

    const addWindowPointerListeners = () => {
      window.addEventListener('pointermove', onPointerMove, capture)
      window.addEventListener('pointerup', onPointerUp, capture)
      window.addEventListener('pointercancel', onPointerCancel, capture)
      window.addEventListener('selectstart', preventNativeGesture, capture)
      window.addEventListener('dragstart', preventNativeGesture, capture)
    }

    const removeWindowPointerListeners = () => {
      window.removeEventListener('pointermove', onPointerMove, capture)
      window.removeEventListener('pointerup', onPointerUp, capture)
      window.removeEventListener('pointercancel', onPointerCancel, capture)
      window.removeEventListener('selectstart', preventNativeGesture, capture)
      window.removeEventListener('dragstart', preventNativeGesture, capture)
    }

    const endActiveToolPointer = () => {
      activeToolPointerId = null
      activeGestureHandlers = null
      removeWindowPointerListeners()
    }

    const onPointerDown = (event: PointerEvent) => {
      const handlers = toolHandlersRef.current
      if (!handlers.onPointerDown || event.button !== 0) return
      if (
        !event.target ||
        !(event.target instanceof Element) ||
        (!event.target.closest('.canvas-scene') && !event.target.closest('.react-flow'))
      ) {
        return
      }

      handlers.onPointerDown(event)
      activeToolPointerId = event.pointerId
      activeGestureHandlers = handlers
      addWindowPointerListeners()
    }

    const preventNativeGesture = (event: Event) => {
      if (activeToolPointerId === null) return

      event.preventDefault()
      event.stopPropagation()
    }

    const onPointerMove = (event: PointerEvent) => {
      if (activeToolPointerId !== event.pointerId) return

      activeGestureHandlers?.onPointerMove?.(event)
    }

    const onPointerUp = (event: PointerEvent) => {
      if (activeToolPointerId !== event.pointerId) return

      activeGestureHandlers?.onPointerUp?.(event)
      endActiveToolPointer()
    }

    const onPointerCancel = (event: PointerEvent) => {
      if (activeToolPointerId !== event.pointerId) return

      activeGestureHandlers?.onPointerCancel?.(event)
      endActiveToolPointer()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      toolHandlersRef.current.onKeyDown?.(event)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      toolHandlersRef.current.onKeyUp?.(event)
    }

    surfaceElement.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      surfaceElement.removeEventListener('pointerdown', onPointerDown)
      removeWindowPointerListeners()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [surfaceRef])
}
