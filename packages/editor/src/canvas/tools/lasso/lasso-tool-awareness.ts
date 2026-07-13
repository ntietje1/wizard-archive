import { parseCanvasLassoAwarenessState } from '../../awareness'
import type { CanvasAwarenessPresenceWriter } from '../canvas-tool-types'
import type { RemoteUser, SelectingState } from '../../utils/canvas-awareness-types'
import { writeValidatedPresence } from '../shared/tool-module-utils'

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
  writeValidatedPresence({
    writer,
    namespace: LASSO_TOOL_AWARENESS_NAMESPACE,
    value: selecting,
    parse: parseCanvasLassoAwarenessState,
    invalidMessage: 'setLassoToolAwareness: invalid lasso awareness payload',
  })
}
