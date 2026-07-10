import { useRef } from 'react'
import {
  CanvasNodeResizeMetadataContext,
  createCanvasNodeResizeMetadataStore,
} from './canvas-node-resize-metadata'
import type { CanvasNodeResizeMetadataStore } from './canvas-node-resize-metadata'

export function CanvasNodeResizeMetadataProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<CanvasNodeResizeMetadataStore | null>(null)
  storeRef.current ??= createCanvasNodeResizeMetadataStore()

  return (
    <CanvasNodeResizeMetadataContext.Provider value={storeRef.current}>
      {children}
    </CanvasNodeResizeMetadataContext.Provider>
  )
}
