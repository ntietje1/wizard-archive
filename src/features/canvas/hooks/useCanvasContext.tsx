import { CanvasRuntimeContext } from './canvas-runtime-context'
import type { CanvasRuntimeContextValue } from './canvas-runtime-context'

export function CanvasProviders({
  runtime,
  children,
}: {
  runtime: CanvasRuntimeContextValue
  children: React.ReactNode
}) {
  return <CanvasRuntimeContext value={runtime}>{children}</CanvasRuntimeContext>
}
