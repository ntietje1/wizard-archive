import { createContext } from 'react'

type CanvasRenderMode = 'interactive' | 'embedded-readonly'

const CanvasRenderModeContext = createContext<CanvasRenderMode>('interactive')

export function CanvasRenderModeProvider({
  mode,
  children,
}: {
  mode: CanvasRenderMode
  children: React.ReactNode
}) {
  return <CanvasRenderModeContext value={mode}>{children}</CanvasRenderModeContext>
}

export { CanvasRenderModeContext }
