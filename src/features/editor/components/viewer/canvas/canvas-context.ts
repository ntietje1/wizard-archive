import { createContext } from 'react'

export interface CanvasContextValue {
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void
}

export const CanvasContext = createContext<CanvasContextValue>({
  updateNodeData: () => {},
})
