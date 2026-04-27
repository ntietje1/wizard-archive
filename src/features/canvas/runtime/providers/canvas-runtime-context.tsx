import type { ReactNode } from 'react'
import { CanvasRuntimeContext } from './canvas-runtime'
import type { CanvasRuntime } from './canvas-runtime'

interface CanvasRuntimeProviderProps extends CanvasRuntime {
  children: ReactNode
}

export function CanvasRuntimeProvider({ children, ...runtime }: CanvasRuntimeProviderProps) {
  return <CanvasRuntimeContext value={runtime}>{children}</CanvasRuntimeContext>
}
