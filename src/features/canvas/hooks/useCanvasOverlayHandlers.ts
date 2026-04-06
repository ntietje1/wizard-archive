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

export function useCanvasOverlayHandlers(
  wrapperRef: React.RefObject<HTMLDivElement | null>,
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
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const onPointerDown = (e: PointerEvent) => {
      const handlers = handlersRef.current
      if (!handlers || e.button !== 0) return
      handlers.onPointerDown(e as unknown as React.PointerEvent)
    }
    const onPointerMove = (e: PointerEvent) => {
      const handlers = handlersRef.current
      if (!handlers) return
      handlers.onPointerMove(e as unknown as React.PointerEvent)
    }
    const onPointerUp = (e: PointerEvent) => {
      const handlers = handlersRef.current
      if (!handlers) return
      handlers.onPointerUp(e as unknown as React.PointerEvent)
    }

    wrapper.addEventListener('pointerdown', onPointerDown)
    wrapper.addEventListener('pointermove', onPointerMove)
    wrapper.addEventListener('pointerup', onPointerUp)
    return () => {
      wrapper.removeEventListener('pointerdown', onPointerDown)
      wrapper.removeEventListener('pointermove', onPointerMove)
      wrapper.removeEventListener('pointerup', onPointerUp)
    }
  }, [wrapperRef])

  const toolCursor = getToolCursor(activeTool)
  return { toolCursor }
}
