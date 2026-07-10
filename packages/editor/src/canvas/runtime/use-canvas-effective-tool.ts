import { useLayoutEffect } from 'react'
import { useStore } from 'zustand'
import type { CanvasToolStore } from '../stores/canvas-tool-store'

export function useCanvasEffectiveTool(toolStore: CanvasToolStore, canEdit: boolean) {
  const storedTool = useStore(toolStore, (state) => state.activeTool)
  const effectiveTool = canEdit ? storedTool : 'select'

  useLayoutEffect(() => {
    if (storedTool !== effectiveTool) {
      toolStore.getState().setActiveTool(effectiveTool)
    }
  }, [effectiveTool, storedTool, toolStore])

  return effectiveTool
}
