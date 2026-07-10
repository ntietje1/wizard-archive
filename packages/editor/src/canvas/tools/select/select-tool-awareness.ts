import { parseCanvasSelectAwarenessState } from '../../awareness'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type { CanvasAwarenessPresenceWriter } from '../canvas-tool-types'
import type { RemoteUser, SelectingState } from '../../utils/canvas-awareness-types'
import { canvasDevLogger } from '../../internal/dev-logger'

const SELECT_TOOL_AWARENESS_NAMESPACE = 'tool.select'

type RectSelectingState = Extract<SelectingState, { type: 'rect' }>

export function readRemoteSelectRectState(remoteUser: RemoteUser): RectSelectingState | null {
  const selecting = remoteUser.presence[SELECT_TOOL_AWARENESS_NAMESPACE]
  return parseCanvasSelectAwarenessState(selecting)
}

export function setSelectToolAwareness(writer: CanvasAwarenessPresenceWriter, rect: Bounds | null) {
  if (rect === null) {
    writer.setPresence(SELECT_TOOL_AWARENESS_NAMESPACE, null)
    return
  }

  const selecting = parseCanvasSelectAwarenessState({
    type: 'rect',
    ...rect,
  })
  if (!selecting) {
    // Ignore malformed local rectangles rather than overwriting the last valid shared presence.
    canvasDevLogger.error('setSelectToolAwareness: ignoring invalid select awareness payload', rect)
    return
  }

  writer.setPresence(SELECT_TOOL_AWARENESS_NAMESPACE, selecting)
}
