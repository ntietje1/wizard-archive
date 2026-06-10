import { useEmbeddedCanvasState } from './use-embedded-canvas-state'
import type {
  EmbeddedCanvasStateResolver,
  EmbeddedCanvasStateResolverProps,
} from './embedded-canvas-state-resolution'

export const LiveEmbeddedCanvasStateResolver: EmbeddedCanvasStateResolver = ({
  canvasId,
  children,
}) => {
  return (
    <LiveResolvedEmbeddedCanvasState canvasId={canvasId}>
      {children}
    </LiveResolvedEmbeddedCanvasState>
  )
}

function LiveResolvedEmbeddedCanvasState({ canvasId, children }: EmbeddedCanvasStateResolverProps) {
  const state = useEmbeddedCanvasState(canvasId)

  return <>{children(state)}</>
}
