import { createContext } from 'react'
import type { ReactNode } from 'react'

type CanvasRenderMode = 'interactive' | 'embedded-readonly'

const CanvasRenderModeContext = createContext<CanvasRenderMode>('interactive')

export function CanvasRenderModeProvider({
  mode,
  children,
}: {
  mode: CanvasRenderMode
  children: ReactNode
}) {
  return <CanvasRenderModeContext value={mode}>{children}</CanvasRenderModeContext>
}

export { CanvasRenderModeContext }
