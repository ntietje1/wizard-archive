import { parseCanvasLassoAwarenessState } from '../../awareness'
import type { CanvasAwarenessPresenceWriter } from '../canvas-tool-types'
import type { RemoteUser, SelectingState } from '../../utils/canvas-awareness-types'
import { canvasDevLogger } from '../../internal/dev-logger'

const LASSO_TOOL_AWARENESS_NAMESPACE = 'tool.lasso'

type LassoSelectingState = Extract<SelectingState, { type: 'lasso' }>

export function readRemoteLassoState(remoteUser: RemoteUser): LassoSelectingState | null {
  const selecting = remoteUser.presence[LASSO_TOOL_AWARENESS_NAMESPACE]
  return parseCanvasLassoAwarenessState(selecting)
}

export function setLassoToolAwareness(
  writer: CanvasAwarenessPresenceWriter,
  selecting: LassoSelectingState | null,
) {
  if (selecting === null) {
    writer.setPresence(LASSO_TOOL_AWARENESS_NAMESPACE, null)
    return
  }

  const parsedSelecting = parseCanvasLassoAwarenessState(selecting)
  if (!parsedSelecting) {
    canvasDevLogger.error('setLassoToolAwareness: invalid lasso awareness payload', selecting)
    return
  }

  writer.setPresence(LASSO_TOOL_AWARENESS_NAMESPACE, parsedSelecting)
}
