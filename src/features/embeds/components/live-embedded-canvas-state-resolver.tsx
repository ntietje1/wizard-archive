import { useLiveEmbeddedCanvasState } from '../hooks/use-live-embedded-canvas-state'
import type {
  EmbeddedCanvasStateResolver,
  EmbeddedCanvasStateResolverProps,
} from '../context/embedded-canvas-state-resolution'

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
  const state = useLiveEmbeddedCanvasState(canvasId)

  return <>{children(state)}</>
}
