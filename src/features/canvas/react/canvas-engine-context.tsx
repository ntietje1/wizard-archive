import { CanvasEngineContext } from './canvas-engine-context-value'
import type { CanvasEngine } from '../system/canvas-engine'
import type { ReactNode } from 'react'

export function CanvasEngineProvider({
  children,
  engine,
}: {
  children: ReactNode
  engine: CanvasEngine
}) {
  return <CanvasEngineContext.Provider value={engine}>{children}</CanvasEngineContext.Provider>
}
