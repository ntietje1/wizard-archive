import { useEffect, useMemo, useRef } from 'react'
import { getToolCursor, useCanvasToolStore } from '../stores/canvas-tool-store'

type PointerHandlers = {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel?: (e: React.PointerEvent) => void
}

interface ToolHandlers {
  drawing: PointerHandlers
  eraser: PointerHandlers
  lasso: PointerHandlers
  rectangleDraw: PointerHandlers
}

function toReactPointerEvent(e: PointerEvent) {
  return e as unknown as React.PointerEvent
}

export function useCanvasOverlayHandlers(
  wrapper: HTMLDivElement | null,
  tools: ToolHandlers,
) {
  const activeTool = useCanvasToolStore((s) => s.activeTool)
  const handlersRef = useRef<PointerHandlers | null>(null)

  const resolved = useMemo(() => {
    const toolMap: Record<string, PointerHandlers | undefined> = {
      draw: tools.drawing,
      erase: tools.eraser,
      lasso: tools.lasso,
      rectangle: tools.rectangleDraw,
    }
    return toolMap[activeTool] ?? null
  }, [activeTool, tools])

  handlersRef.current = resolved

  useEffect(() => {
    if (!wrapper) return

    const onPointerDown = (e: PointerEvent) => {
      const handlers = handlersRef.current
      if (!handlers || e.button !== 0) return
      if (
        !e.target ||
        !(e.target instanceof Element) ||
        !e.target.closest('.react-flow')
      )
        return
      handlers.onPointerDown(toReactPointerEvent(e))
    }
    const onPointerMove = (e: PointerEvent) => {
      const handlers = handlersRef.current
      if (!handlers) return
      handlers.onPointerMove(toReactPointerEvent(e))
    }
    const onPointerUp = (e: PointerEvent) => {
      const handlers = handlersRef.current
      if (!handlers) return
      handlers.onPointerUp(toReactPointerEvent(e))
    }

    const onPointerCancel = (e: PointerEvent) => {
      const handlers = handlersRef.current
      if (!handlers) return
      if (handlers.onPointerCancel) {
        handlers.onPointerCancel(toReactPointerEvent(e))
      } else {
        handlers.onPointerUp(toReactPointerEvent(e))
      }
    }

    wrapper.addEventListener('pointerdown', onPointerDown)
    wrapper.addEventListener('pointermove', onPointerMove)
    wrapper.addEventListener('pointerup', onPointerUp)
    wrapper.addEventListener('pointercancel', onPointerCancel)
    return () => {
      wrapper.removeEventListener('pointerdown', onPointerDown)
      wrapper.removeEventListener('pointermove', onPointerMove)
      wrapper.removeEventListener('pointerup', onPointerUp)
      wrapper.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [wrapper])

  const toolCursor = getToolCursor(activeTool)
  return { toolCursor }
}
