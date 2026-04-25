import { createContext } from 'react'
import type { CanvasEngine } from '../system/canvas-engine'

export const CanvasEngineContext = createContext<CanvasEngine | null>(null)

CanvasEngineContext.displayName = 'CanvasEngineContext'
