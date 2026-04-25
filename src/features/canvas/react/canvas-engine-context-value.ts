import { createContext, useContext } from 'react'
import type { CanvasEngine } from '../system/canvas-engine'

export const CanvasEngineContext = createContext<CanvasEngine | null>(null)

CanvasEngineContext.displayName = 'CanvasEngineContext'

export function useCanvasEngine(): CanvasEngine {
  const engine = useContext(CanvasEngineContext)
  if (!engine) {
    throw new Error('useCanvasEngine must be used within CanvasEngineProvider')
  }

  return engine
}
