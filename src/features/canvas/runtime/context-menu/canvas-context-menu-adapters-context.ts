import { createContext, useContext } from 'react'
import type { CanvasContextMenuAdapters } from './canvas-context-menu-types'

export const CanvasContextMenuAdaptersContext = createContext<CanvasContextMenuAdapters | null>(
  null,
)

export function useCanvasContextMenuAdapters(): CanvasContextMenuAdapters | null {
  return useContext(CanvasContextMenuAdaptersContext)
}
