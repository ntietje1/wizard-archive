import { CanvasRuntimeProviders } from './canvas-runtime-context'
import type { CanvasProviderValues } from './canvas-runtime-context'

export function CanvasProviders({
  runtime,
  children,
}: {
  runtime: CanvasProviderValues
  children: React.ReactNode
}) {
  return <CanvasRuntimeProviders value={runtime}>{children}</CanvasRuntimeProviders>
}
