import { parseCanvasSelectAwarenessState } from '../../awareness'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type { CanvasAwarenessPresenceWriter } from '../canvas-tool-types'
import type { RemoteUser, SelectingState } from '../../utils/canvas-awareness-types'
import { writeValidatedPresence } from '../shared/tool-module-utils'

const SELECT_TOOL_AWARENESS_NAMESPACE = 'tool.select'

type RectSelectingState = Extract<SelectingState, { type: 'rect' }>

export function readRemoteSelectRectState(remoteUser: RemoteUser): RectSelectingState | null {
  const selecting = remoteUser.presence[SELECT_TOOL_AWARENESS_NAMESPACE]
  return parseCanvasSelectAwarenessState(selecting)
}

export function setSelectToolAwareness(writer: CanvasAwarenessPresenceWriter, rect: Bounds | null) {
  writeValidatedPresence({
    writer,
    namespace: SELECT_TOOL_AWARENESS_NAMESPACE,
    value: rect === null ? null : { type: 'rect', ...rect },
    parse: parseCanvasSelectAwarenessState,
    invalidMessage: 'setSelectToolAwareness: ignoring invalid select awareness payload',
    invalidValue: rect,
  })
}
