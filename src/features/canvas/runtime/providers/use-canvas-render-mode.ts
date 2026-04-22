import { useContext } from 'react'
import { CanvasRenderModeContext } from './canvas-render-mode-context'

function useCanvasRenderMode() {
  return useContext(CanvasRenderModeContext)
}

export function useIsInteractiveCanvasRenderMode() {
  return useCanvasRenderMode() === 'interactive'
}
