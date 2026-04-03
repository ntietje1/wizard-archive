import { useMemo } from 'react'
import { getToolCursor, useCanvasToolStore } from '../stores/canvas-tool-store'

type PointerHandlers = {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
}

interface ToolHandlers {
  drawing: PointerHandlers
  eraser: PointerHandlers
  lasso: PointerHandlers
  rectangleDraw: PointerHandlers
}

export function useCanvasOverlayHandlers(tools: ToolHandlers) {
  const activeTool = useCanvasToolStore((s) => s.activeTool)

  const overlayHandlers = useMemo(() => {
    const toolMap: Record<string, PointerHandlers | undefined> = {
      draw: tools.drawing,
      erase: tools.eraser,
      lasso: tools.lasso,
      rectangle: tools.rectangleDraw,
    }
    return toolMap[activeTool] ?? null
  }, [activeTool, tools])

  const toolCursor = getToolCursor(activeTool)

  return { overlayHandlers, toolCursor }
}
