import { useContext } from 'react'
import { CanvasRenderModeContext } from './canvas-render-mode-context'

export function useIsInteractiveCanvasRenderMode() {
  return useContext(CanvasRenderModeContext) === 'interactive'
}
