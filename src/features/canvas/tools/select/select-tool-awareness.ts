import type { Bounds } from '../../utils/canvas-geometry-utils'
import type { CanvasAwarenessPresenceWriter } from '../canvas-tool-types'
import type { RemoteUser, SelectingState } from '../../utils/canvas-awareness-types'

const SELECT_TOOL_AWARENESS_NAMESPACE = 'tool.select'

type RectSelectingState = Extract<SelectingState, { type: 'rect' }>

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRectSelectingState(value: unknown): value is RectSelectingState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const candidate = value as {
    type?: unknown
    x?: unknown
    y?: unknown
    width?: unknown
    height?: unknown
  }

  return (
    candidate.type === 'rect' &&
    isFiniteNumber(candidate.x) &&
    isFiniteNumber(candidate.y) &&
    isFiniteNumber(candidate.width) &&
    candidate.width >= 0 &&
    isFiniteNumber(candidate.height) &&
    candidate.height >= 0
  )
}

export function readRemoteSelectRectState(remoteUser: RemoteUser): RectSelectingState | null {
  const selecting = remoteUser.presence[SELECT_TOOL_AWARENESS_NAMESPACE]
  return isRectSelectingState(selecting) ? selecting : null
}

export function setSelectToolAwareness(writer: CanvasAwarenessPresenceWriter, rect: Bounds | null) {
  writer.setPresence(SELECT_TOOL_AWARENESS_NAMESPACE, rect ? { type: 'rect', ...rect } : null)
}
